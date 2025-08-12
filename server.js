// server.js - SERVIDOR ACTUALIZADO
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const { getAgentResponse } = require("./services/conversationService");
const { sendMessageToGuest } = require("./services/hostawayService");
const { analyzeConversationPatterns } = require("./services/conversationHistoryService");
const { learnFromHistory } = require("./services/faqService");

const app = express();
app.use(bodyParser.json());

// Middleware para logging mejorado
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Conectado a MongoDB, 🔗 Conectado a: ", mongoose.connection.name);
    
    // Ejecutar aprendizaje automático cada hora
    setInterval(async () => {
      try {
        console.log("🧠 Ejecutando aprendizaje automático...");
        await learnFromHistory();
      } catch (error) {
        console.error("❌ Error en aprendizaje automático:", error);
      }
    }, 60 * 60 * 1000); // 1 hora
  })
  .catch(err => console.error("❌ Error MongoDB:", err));

// Webhook endpoint mejorado
app.post("/webhooks/hostaway", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { event, data } = req.body;
    
    // Log detallado del webhook recibido
    console.log("📥 Webhook recibido:", {
      event,
      timestamp: new Date().toISOString(),
      guestId: data?.guestId,
      reservationId: data?.reservationId
    });

    if (event !== "messageCreated") {
      console.log("ℹ️ Evento ignorado:", event);
      return res.sendStatus(200);
    }

    const guestId = data.guestId;
    const message = data.message;
    const reservationId = data.reservationId;
    const listingMapId = Number(data.ListingMapId);

    // Validación de datos requeridos
    if (!guestId || !message || !reservationId) {
      console.error("❌ Datos faltantes en el webhook:", { guestId, message, reservationId });
      return res.status(400).json({ error: "Datos faltantes" });
    }

    console.log("📌 Procesando mensaje:", {
      guestId,
      message: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
      listingMapId
    });

    // 🔹 Analizar patrones de conversación antes de responder
    const patterns = await analyzeConversationPatterns(guestId);
    if (patterns?.needsHumanSupport) {
      console.log("🚨 Huésped necesita soporte humano - notificando...");
      const { notifySupport } = require("./services/supportNotificationService");
      await notifySupport({
        guestId,
        reservationId,
        listingMapId,
        question: message,
        reason: "Múltiples consultas sin resolución satisfactoria"
      });
    }

    // 🔹 Generar respuesta con contexto mejorado
    const response = await getAgentResponse(message, listingMapId, guestId, reservationId);

    // 🔹 Enviar respuesta al huésped
    await sendMessageToGuest(reservationId, response);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Mensaje procesado exitosamente en ${processingTime}ms`);

    res.json({
      success: true,
      processingTime,
      guestId,
      reservationId
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ Error procesando webhook:", error);
    
    // Notificar error crítico
    try {
      const { notifySupport } = require("./services/supportNotificationService");
      await notifySupport({
        guestId: req.body?.data?.guestId || "unknown",
        reservationId: req.body?.data?.reservationId || "unknown",
        listingMapId: req.body?.data?.ListingMapId || 0,
        question: req.body?.data?.message || "Error en procesamiento",
        error: error.message,
        reason: "Error crítico en webhook"
      });
    } catch (notificationError) {
      console.error("❌ Error adicional notificando soporte:", notificationError);
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      processingTime
    });
  }
});

// 🔹 NUEVOS ENDPOINTS PARA ADMINISTRACIÓN

// Endpoint para obtener estadísticas del agente
app.get("/admin/stats", async (req, res) => {
  try {
    const Conversation = require("./models/conversation");
    const SupportTicket = require("./models/SupportTicket");

    const stats = await Promise.all([
      // Estadísticas de conversaciones
      Conversation.countDocuments(),
      Conversation.aggregate([
        { $unwind: "$messages" },
        { $match: { "messages.role": "agent" } },
        { $group: { 
            _id: "$messages.metadata.source", 
            count: { $sum: 1 } 
          }
        }
      ]),
      
      // Estadísticas de tickets de soporte
      SupportTicket.countDocuments({ status: "open" }),
      SupportTicket.aggregate([
        { $group: { 
            _id: "$priority", 
            count: { $sum: 1 } 
          }
        }
      ]),

      // Conversaciones activas en las últimas 24 horas
      Conversation.countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      totalConversations: stats[0],
      responsesBySource: stats[1],
      openTickets: stats[2],
      ticketsByPriority: stats[3],
      activeConversations24h: stats[4],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// Endpoint para obtener tickets de soporte pendientes
app.get("/admin/tickets", async (req, res) => {
  try {
    const SupportTicket = require("./models/SupportTicket");
    const { status = "open", priority, limit = 20 } = req.query;

    const filter = { status };
    if (priority) filter.priority = priority;

    const tickets = await SupportTicket.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      tickets,
      total: tickets.length,
      filter: { status, priority }
    });

  } catch (error) {
    console.error("❌ Error obteniendo tickets:", error);
    res.status(500).json({ error: "Error obteniendo tickets" });
  }
});

// Endpoint para resolver un ticket
app.put("/admin/tickets/:ticketId/resolve", async (req, res) => {
  try {
    const SupportTicket = require("./models/SupportTicket");
    const { ticketId } = req.params;
    const { resolution, resolvedBy } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        status: "resolved",
        resolution,
        "metadata.resolvedAt": new Date(),
        "metadata.resolvedBy": resolvedBy
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    res.json({
      success: true,
      ticket
    });

  } catch (error) {
    console.error("❌ Error resolviendo ticket:", error);
    res.status(500).json({ error: "Error resolviendo ticket" });
  }
});

// Endpoint para obtener historial de conversación
app.get("/admin/conversations/:guestId", async (req, res) => {
  try {
    const { getConversationHistory, analyzeConversationPatterns } = require("./services/conversationHistoryService");
    const { guestId } = req.params;
    const { limit = 20 } = req.query;

    const [history, patterns] = await Promise.all([
      getConversationHistory(guestId, parseInt(limit)),
      analyzeConversationPatterns(guestId)
    ]);

    res.json({
      guestId,
      history,
      patterns,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error obteniendo conversación:", error);
    res.status(500).json({ error: "Error obteniendo conversación" });
  }
});

// Endpoint para forzar aprendizaje automático
app.post("/admin/learn", async (req, res) => {
  try {
    console.log("🧠 Ejecutando aprendizaje forzado...");
    const patterns = await learnFromHistory();
    
    res.json({
      success: true,
      message: "Aprendizaje ejecutado",
      patternsFound: patterns.length,
      patterns: patterns.slice(0, 10), // Mostrar solo los primeros 10
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error en aprendizaje forzado:", error);
    res.status(500).json({ error: "Error ejecutando aprendizaje" });
  }
});

// Endpoint de salud del sistema
app.get("/health", async (req, res) => {
  try {
    // Verificar conexión a MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    // Verificar OpenAI (opcional)
    let openaiStatus = "unknown";
    try {
      const { ask } = require("./services/gptService");
      await ask("Test");
      openaiStatus = "connected";
    } catch {
      openaiStatus = "error";
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        openai: openaiStatus
      },
      version: process.env.npm_package_version || "1.0.0"
    });

  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
  console.error("❌ Error no manejado:", error);
  
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Cerrando servidor gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ Conexión MongoDB cerrada');
  } catch (error) {
    console.error('❌ Error cerrando MongoDB:', error);
  }
  
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Smithers v2 activo en puerto: ${PORT}`);
  console.log(`📊 Panel de estadísticas: http://localhost:${PORT}/admin/stats`);
  console.log(`🏥 Estado del sistema: http://localhost:${PORT}/health`);
});