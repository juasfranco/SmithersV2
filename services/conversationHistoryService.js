// services/conversationHistoryService.js - CORREGIDO SIN DUPLICACIÓN
const mongoose = require("mongoose");
const Conversation = require("../models/conversation");

/**
 * Verifica el estado de conexión a MongoDB
 */
function checkMongoConnection() {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  console.log(`🔍 Estado MongoDB: ${states[state]} (${state})`);
  return state === 1;
}

/**
 * Guarda un mensaje en el historial de conversación
 */
async function saveConversation(guestId, role, content, metadata = {}) {
  console.log("🔍 DEBUG saveConversation llamado con:", {
    guestId,
    role,
    content: content?.substring(0, 100),
    metadata
  });

  try {
    // Verificar conexión correctamente
    if (!checkMongoConnection()) {
      console.error("❌ MongoDB no está conectado. Estado:", mongoose.connection.readyState);
      
      // Intentar reconectar si es necesario
      if (mongoose.connection.readyState === 0) {
        console.log("🔄 Intentando reconectar a MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
      }
      
      if (!checkMongoConnection()) {
        throw new Error("MongoDB no disponible después de intento de reconexión");
      }
    }

    console.log("✅ MongoDB conectado, procediendo con guardado...");
    
    let conversation = await Conversation.findOne({ guestId });
    
    if (!conversation) {
      console.log("📝 Creando nueva conversación para:", guestId);
      conversation = new Conversation({
        guestId,
        messages: [],
        lastActivity: new Date(),
        summary: {
          totalMessages: 0,
          needsHumanSupport: false,
          commonTopics: [],
          satisfactionScore: null
        }
      });
    } else {
      console.log("📋 Conversación existente encontrada, mensajes actuales:", conversation.messages.length);
    }

    const newMessage = {
      role,
      content,
      timestamp: new Date(),
      metadata: metadata || {}
    };

    console.log("📨 Agregando mensaje:", {
      role: newMessage.role,
      contentLength: newMessage.content.length,
      timestamp: newMessage.timestamp
    });
    
    conversation.messages.push(newMessage);

    // Mantener solo los últimos 50 mensajes
    if (conversation.messages.length > 50) {
      console.log("✂️ Recortando mensajes, había:", conversation.messages.length);
      conversation.messages = conversation.messages.slice(-50);
    }

    // Actualizar campos antes de guardar
    conversation.lastActivity = new Date();
    conversation.summary.totalMessages = conversation.messages.length;

    console.log("💾 Intentando guardar conversación...");
    const savedConversation = await conversation.save();
    
    console.log("✅ Conversación guardada exitosamente:", {
      id: savedConversation._id,
      guestId: savedConversation.guestId,
      totalMessages: savedConversation.messages.length
    });
    
    return savedConversation;
    
  } catch (error) {
    console.error("❌ Error detallado guardando conversación:", {
      error: error.message,
      guestId,
      role,
      content: content?.substring(0, 50),
      mongoState: mongoose.connection.readyState
    });
    
    return null;
  }
}

/**
 * Obtiene el historial de conversación de un huésped
 */
async function getConversationHistory(guestId, limit = 10) {
  console.log("🔍 DEBUG getConversationHistory para:", guestId);
  
  try {
    if (!checkMongoConnection()) {
      console.error("❌ MongoDB no conectado en getConversationHistory");
      return [];
    }

    const conversation = await Conversation.findOne({ guestId });
    console.log("📋 Conversación encontrada:", conversation ? `${conversation.messages.length} mensajes` : "No encontrada");
    
    if (!conversation || !conversation.messages) {
      return [];
    }

    const history = conversation.messages
      .slice(-limit)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata || {}
      }));

    console.log("📝 Devolviendo historial:", history.length, "mensajes");
    return history;
      
  } catch (error) {
    console.error("❌ Error obteniendo historial:", error);
    return [];
  }
}

/**
 * Analiza patrones en el historial para mejorar respuestas
 */
async function analyzeConversationPatterns(guestId) {
  try {
    if (!checkMongoConnection()) {
      console.error("❌ MongoDB no conectado en analyzeConversationPatterns");
      return null;
    }

    const history = await getConversationHistory(guestId, 20);
    
    const analysis = {
      totalMessages: history.length,
      guestMessages: history.filter(m => m.role === 'guest').length,
      agentMessages: history.filter(m => m.role === 'agent').length,
      commonTopics: [],
      lastInteraction: history.length > 0 ? history[history.length - 1].timestamp : null,
      needsHumanSupport: false
    };

    // Detectar temas frecuentes
    const topics = {};
    history.forEach(msg => {
      if (msg.metadata && msg.metadata.detectedField) {
        topics[msg.metadata.detectedField] = (topics[msg.metadata.detectedField] || 0) + 1;
      }
    });

    analysis.commonTopics = Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    // Detectar si necesita soporte humano
    const recentFallbacks = history.slice(-5).filter(msg => 
      msg.role === 'agent' && msg.metadata && msg.metadata.source === 'fallback'
    ).length;

    analysis.needsHumanSupport = recentFallbacks >= 2;

    return analysis;
    
  } catch (error) {
    console.error("❌ Error analizando patrones:", error);
    return null;
  }
}

/**
 * Función para debugging
 */
async function debugConversations() {
  try {
    console.log("🔍 DEBUG: Verificando estado de MongoDB y conversaciones...");
    
    const isConnected = checkMongoConnection();
    console.log("📡 Estado conexión:", isConnected ? "CONECTADO" : "DESCONECTADO");
    
    if (!isConnected) {
      return {
        error: "MongoDB no conectado",
        mongoState: mongoose.connection.readyState,
        mongoHost: mongoose.connection.host,
        mongoName: mongoose.connection.name
      };
    }
    
    const totalConversations = await Conversation.countDocuments();
    console.log("📊 Total conversaciones en DB:", totalConversations);
    
    const recentConversations = await Conversation.find()
      .sort({ lastActivity: -1 })
      .limit(5)
      .lean();
    
    console.log("📝 Conversaciones recientes:");
    recentConversations.forEach(conv => {
      console.log(`  - ${conv.guestId}: ${conv.messages.length} mensajes`);
    });
    
    return { 
      totalConversations, 
      recentConversations,
      mongoState: mongoose.connection.readyState,
      mongoHost: mongoose.connection.host,
      mongoName: mongoose.connection.name
    };
  } catch (error) {
    console.error("❌ Error en debug:", error);
    return {
      error: error.message,
      mongoState: mongoose.connection.readyState
    };
  }
}

/**
 * Verificar y reparar conexión
 */
async function ensureConnection() {
  try {
    if (checkMongoConnection()) {
      return true;
    }
    
    console.log("🔄 Intentando reconectar a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    return checkMongoConnection();
    
  } catch (error) {
    console.error("❌ Error reconectando:", error);
    return false;
  }
}

module.exports = {
  saveConversation,
  getConversationHistory,
  analyzeConversationPatterns,
  debugConversations,
  checkMongoConnection,
  ensureConnection
};