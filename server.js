// server.js - VERSIÓN CORREGIDA CON MEJOR MANEJO DE CONEXIÓN
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

// 🔹 CORRECCIÓN: Mejor manejo de conexión MongoDB
let isMongoConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;

async function connectToMongoDB() {
  try {
    console.log("🔄 Intentando conectar a MongoDB...");
    console.log("🔗 URI:", process.env.MONGODB_URI ? "Configurado" : "❌ NO CONFIGURADO");
    
    await mongoose.connect(process.env.MONGODB_URI, {
      // Opciones de conexión mejoradas
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    });
    
    isMongoConnected = true;
    connectionRetries = 0;
    
    console.log("✅ Conectado a MongoDB:", mongoose.connection.name);
    console.log("📊 Estado de conexión:", mongoose.connection.readyState);
    
    // Verificar colecciones existentes
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📁 Colecciones encontradas:", collections.map(c => c.name));
    
    // Verificar datos existentes
    try {
      const hostawayCount = await mongoose.connection.db.collection('HostAwayListings').countDocuments();
      const faqsCount = await mongoose.connection.db.collection('Faqs').countDocuments();
      const conversationCount = await mongoose.connection.db.collection('Conversation').countDocuments();
      
      console.log(`📈 Datos existentes:
      - HostAwayListings: ${hostawayCount} documentos
      - Faqs: ${faqsCount} documentos  
      - Conversation: ${conversationCount} documentos`);
    } catch (countError) {
      console.log("⚠️ Error contando documentos:", countError.message);
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    isMongoConnected = false;
    connectionRetries++;
    
    if (connectionRetries < MAX_RETRIES) {
      console.log(`🔄 Reintentando conexión en 5 segundos... (${connectionRetries}/${MAX_RETRIES})`);
      setTimeout(connectToMongoDB, 5000);
    } else {
      console.error("💥 Máximo de reintentos alcanzado. Revisa tu configuración de MongoDB.");
    }
    
    return false;
  }
}

// 🔹 CORRECCIÓN: Monitorear estado de conexión
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB conectado');
  isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Error en MongoDB:', err);
  isMongoConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB desconectado');
  isMongoConnected = false;
  
  // Intentar reconectar automáticamente
  setTimeout(connectToMongoDB, 5000);
});

// Middleware para logging mejorado
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 🔹 MIDDLEWARE: Verificar conexión MongoDB en endpoints críticos
function requireMongoDB(req, res, next) {
  if (!isMongoConnected || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Servicio temporalmente no disponible",
      message: "Base de datos no conectada",
      mongoState: mongoose.connection.readyState
    });
  }
  next();
}

// Inicializar servidor
async function startServer() {
  // Conectar a MongoDB
  await connectToMongoDB();
  
  // Solo iniciar el aprendizaje automático si MongoDB está conectado
  if (isMongoConnected) {
    // Ejecutar aprendizaje automático cada hora
    setInterval(async () => {
      if (isMongoConnected) {
        try {
          console.log("🧠 Ejecutando aprendizaje automático...");
          await learnFromHistory();
        } catch (error) {
          console.error("❌ Error en aprendizaje automático:", error);
        }
      }
    }, 60 * 60 * 1000); // 1 hora
  }
}

// 🔹 WEBHOOK PRINCIPAL MEJORADO CON VERIFICACIÓN DE CONEXIÓN
app.post("/webhooks/hostaway", async (req, res) => {
  const startTime = Date.now();
  
  // Verificar conexión antes de procesar
  if (!isMongoConnected) {
    console.error("⚠️ Webhook recibido pero MongoDB no conectado");
    return res.status(503).json({
      error: "Servicio temporalmente no disponible",
      message: "Base de datos no conectada"
    });
  }
  
  try {
    console.log("📥 Webhook de Hostaway recibido:", {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body
    });

    // Detectar formato de webhook (tu código existente)
    let event, data;
    
    if (req.body.event && req.body.data) {
      event = req.body.event;
      data = req.body.data;
    } else if (req.body.event && req.body.reservationId) {
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
    } else if (req.body.data) {
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

    // Procesar con el manejador mejorado
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

// Resto de endpoints con middleware de verificación MongoDB
app.get("/admin/stats", requireMongoDB, async (req, res) => {
  try {
    const Conversation = require("./models/conversation");
    const SupportTicket = require("./models/SupportTicket");

    const stats = await Promise.all([
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
      SupportTicket.countDocuments({ status: "open" }),
      SupportTicket.aggregate([
        { $group: { 
            _id: "$priority", 
            count: { $sum: 1 } 
          }
        }
      ]),
      Conversation.countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
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

// Endpoint de salud mejorado
app.get("/health", async (req, res) => {
  try {
    // Verificar conexión a MongoDB
    const mongoStatus = isMongoConnected && mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    // Verificar OpenAI
    let openaiStatus = "unknown";
    try {
      const { ask } = require("./services/gptService");
      await ask("Test");
      openaiStatus = "connected";
    } catch {
      openaiStatus = "error";
    }

    // Verificar conexión a Hostaway
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
        mongodb: {
          status: mongoStatus,
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name
        },
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

// 🔹 ENDPOINTS DE DEBUG MEJORADOS
app.get("/debug/conversations", async (req, res) => {
  try {
    const { debugConversations } = require("./services/conversationHistoryService");
    const debug = await debugConversations();
    
    res.json({
      debug,
      mongoStatus: {
        isConnected: isMongoConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/debug/test-save", requireMongoDB, async (req, res) => {
  try {
    const { saveConversation, ensureConnection } = require("./services/conversationHistoryService");
    
    // Asegurar conexión antes de la prueba
    const connected = await ensureConnection();
    if (!connected) {
      return res.status(503).json({ error: "No se pudo conectar a MongoDB" });
    }
    
    await saveConversation("debug-guest-123", "guest", "Mensaje de prueba desde debug");
    await saveConversation("debug-guest-123", "agent", "Respuesta de prueba desde debug");
    
    res.json({ success: true, message: "Prueba de guardado completada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 NUEVO: Endpoint para forzar reconexión
app.post("/debug/reconnect-mongo", async (req, res) => {
  try {
    console.log("🔄 Forzando reconexión a MongoDB...");
    await mongoose.disconnect();
    const connected = await connectToMongoDB();
    
    res.json({
      success: connected,
      message: connected ? "Reconexión exitosa" : "Error en reconexión",
      mongoState: mongoose.connection.readyState
    });
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

// Graceful shutdown mejorado
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

// Inicializar servidor
startServer().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Smithers v2 con integración Hostaway activo en puerto: ${PORT}`);
    console.log(`📊 Panel de estadísticas: http://localhost:${PORT}/admin/stats`);
    console.log(`🏥 Estado del sistema: http://localhost:${PORT}/health`);
    console.log(`🔧 Debug conversaciones: http://localhost:${PORT}/debug/conversations`);
    console.log(`🔄 Reconectar MongoDB: POST http://localhost:${PORT}/debug/reconnect-mongo`);
  });
}).catch(error => {
  console.error("💥 Error iniciando servidor:", error);
  process.exit(1);
});