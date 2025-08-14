// server.js - SERVIDOR ACTUALIZADO CON INTEGRACIÓN HOSTAWAY COMPLETA
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const { handleHostawayWebhook } = require("./services/enhancedWebhookHandler");
const { analyzeConversationPatterns } = require("./services/conversationHistoryService");
const { learnFromHistory } = require("./services/faqService");
const { hostawayService } = require("./services/hostawayService");

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

// 🔹 WEBHOOK PRINCIPAL MEJORADO CON HOSTAWAY API
app.post("/webhooks/hostaway", async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log("📥 Webhook de Hostaway recibido:", {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body
    });

    // 🔹 DETECTAR FORMATO DE WEBHOOK
    let event, data;
    
    // Formato nuevo de Hostaway (unified webhooks)
    if (req.body.event && req.body.data) {
      event = req.body.event;
      data = req.body.data;
    }
    // Formato anterior (compatibilidad)
    else if (req.body.event && req.body.reservationId) {
      event = req.body.event === 'messageCreated' ? 'new message received' : req.body.event;
      data = {
        reservationId: req.body.reservationId,
        conversationId: req.body.conversationId,
        messageId: req.body.messageId,
        message: req.body.message,
        messageType: req.body.messageType,
        guestId: req.body.guestId,
        listingMapId: req.body.ListingMapId
      };
    }
    // Formato personalizado actual
    else if (req.body.data) {
      event = 'new message received';
      data = {
        reservationId: req.body.data.reservationId,
        conversationId: req.body.data.conversationId,
        message: req.body.data.message,
        guestId: req.body.data.guestId,
        listingMapId: req.body.data.ListingMapId
      };
    } else {
      return res.status(400).json({ 
        error: "Formato de webhook no reconocido",
        receivedKeys: Object.keys(req.body)
      });
    }

    console.log("🔍 Evento procesando:", event);
    console.log("📊 Datos extraídos:", {
      reservationId: data.reservationId,
      conversationId: data.conversationId,
      messagePreview: data.message?.substring(0, 50)
    });

    // 🔹 PROCESAR CON EL MANEJADOR MEJORADO
    const result = await handleHostawayWebhook(event, data);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook procesado exitosamente en ${processingTime}ms`);

    res.json({
      success: true,
      event,
      processingTime,
      result
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ Error procesando webhook de Hostaway:", error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔹 WEBHOOK PARA PRUEBAS LOCALES (mantienes tu formato actual)
app.post("/webhooks/hostaway/local", async (req, res) => {
  try {
    console.log("🧪 Webhook de prueba local recibido");
    
    const { event, data } = req.body;
    const result = await handleHostawayWebhook(event || 'new message received', data);
    
    res.json({ success: true, result });
    
  } catch (error) {
    console.error("❌ Error en webhook local:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVOS ENDPOINTS PARA ADMINISTRACIÓN CON HOSTAWAY

// Endpoint para obtener estadísticas del agente con datos de Hostaway
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
      }),
      
      // Conversaciones con datos de Hostaway
      Conversation.countDocuments({
        "messages.metadata.hostaway": true
      })
    ]);

    res.json({
      totalConversations: stats[0],
      responsesBySource: stats[1],
      openTickets: stats[2],
      ticketsByPriority: stats[3],
      activeConversations24h: stats[4],
      hostawayIntegratedConversations: stats[5],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// 🔹 NUEVO: Endpoint para obtener datos de reserva desde Hostaway
app.get("/admin/hostaway/reservation/:reservationId", async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    console.log(`🔍 Buscando reserva ${reservationId} en Hostaway...`);
    const reservation = await hostawayService.getReservationById(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    res.json({
      success: true,
      reservation: {
        id: reservation.id,
        listingMapId: reservation.listingMapId,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail,
        checkIn: reservation.arrivalDate,
        checkOut: reservation.departureDate,
        status: reservation.status,
        totalPrice: reservation.totalPrice,
        currency: reservation.currencyCode,
        source: reservation.channelName
      }
    });

  } catch (error) {
    console.error("❌ Error obteniendo reserva:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVO: Endpoint para obtener conversación desde Hostaway
app.get("/admin/hostaway/conversation/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    console.log(`💬 Buscando conversación ${conversationId} en Hostaway...`);
    const conversation = await hostawayService.getConversationById(conversationId);
    const messages = await hostawayService.getConversationMessages(conversationId, 20);
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        reservationId: conversation.reservationId,
        totalMessages: messages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          type: msg.type,
          message: msg.message,
          sentAt: msg.insertedOn,
          isFromGuest: msg.type === 'inquiry'
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error obteniendo conversación:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVO: Endpoint para obtener contexto completo
app.get("/admin/hostaway/context/:reservationId", async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { conversationId } = req.query;
    
    console.log(`📊 Obteniendo contexto completo para reserva ${reservationId}...`);
    const { getCompleteContext } = require("./services/hostawayService");
    const context = await getCompleteContext(reservationId, conversationId);
    
    res.json({
      success: true,
      context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error obteniendo contexto:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVO: Endpoint para buscar reservas
app.get("/admin/hostaway/reservations/search", async (req, res) => {
  try {
    const { guestEmail, guestPhone, listingMapId, status, limit } = req.query;
    
    const filters = {};
    if (guestEmail) filters.guestEmail = guestEmail;
    if (guestPhone) filters.guestPhone = guestPhone;
    if (listingMapId) filters.listingMapId = listingMapId;
    if (status) filters.status = status;
    if (limit) filters.limit = limit;

    console.log("🔍 Buscando reservas con filtros:", filters);
    const reservations = await hostawayService.searchReservations(filters);
    
    res.json({
      success: true,
      reservations: reservations.map(res => ({
        id: res.id,
        listingMapId: res.listingMapId,
        guestName: res.guestName,
        guestEmail: res.guestEmail,
        checkIn: res.arrivalDate,
        checkOut: res.departureDate,
        status: res.status
      })),
      count: reservations.length
    });

  } catch (error) {
    console.error("❌ Error buscando reservas:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVO: Endpoint para probar envío de mensaje
app.post("/admin/hostaway/test-message", async (req, res) => {
  try {
    const { reservationId, message } = req.body;
    
    if (!reservationId || !message) {
      return res.status(400).json({ error: "Se requiere reservationId y message" });
    }

    console.log(`📤 Enviando mensaje de prueba a reserva ${reservationId}...`);
    const result = await hostawayService.sendMessageToGuest(reservationId, message);
    
    if (result) {
      res.json({
        success: true,
        messageId: result.id,
        message: "Mensaje enviado exitosamente"
      });
    } else {
      res.status(500).json({ error: "No se pudo enviar el mensaje" });
    }

  } catch (error) {
    console.error("❌ Error enviando mensaje de prueba:", error);
    res.status(500).json({ error: error.message });
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

// Endpoint de salud del sistema con verificación de Hostaway
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

    // 🔹 NUEVO: Verificar conexión a Hostaway
    let hostawayStatus = "unknown";
    try {
      await hostawayService.getAccessToken();
      hostawayStatus = "connected";
    } catch {
      hostawayStatus = "error";
    }

    const isHealthy = mongoStatus === "connected" && openaiStatus === "connected" && hostawayStatus === "connected";

    res.status(isHealthy ? 200 : 500).json({
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        openai: openaiStatus,
        hostaway: hostawayStatus
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

// 🔹 ENDPOINTS DE DEBUG
app.get("/debug/conversations", async (req, res) => {
  try {
    const { debugConversations } = require("./services/conversationHistoryService");
    const debug = await debugConversations();
    
    res.json({
      debug,
      mongoStatus: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/debug/test-save", async (req, res) => {
  try {
    const { saveConversation } = require("./services/conversationHistoryService");
    
    await saveConversation("debug-guest-123", "guest", "Mensaje de prueba desde debug");
    await saveConversation("debug-guest-123", "agent", "Respuesta de prueba desde debug");
    
    res.json({ success: true, message: "Prueba de guardado completada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  console.log(`🚀 Smithers v2 con integración Hostaway activo en puerto: ${PORT}`);
  console.log(`📊 Panel de estadísticas: http://localhost:${PORT}/admin/stats`);
  console.log(`🏥 Estado del sistema: http://localhost:${PORT}/health`);
  console.log(`🔍 Hostaway - Reserva: http://localhost:${PORT}/admin/hostaway/reservation/{id}`);
  console.log(`💬 Hostaway - Conversación: http://localhost:${PORT}/admin/hostaway/conversation/{id}`);
  console.log(`📋 Hostaway - Contexto: http://localhost:${PORT}/admin/hostaway/context/{reservationId}`);
  });