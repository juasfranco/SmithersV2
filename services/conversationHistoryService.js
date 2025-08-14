// services/conversationHistoryService.js - VERSION DEBUG
const Conversation = require("../models/conversation");

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
    // Verificar conexión a MongoDB
    if (!Conversation.db.readyState) {
      console.error("❌ MongoDB no está conectado");
      return;
    }

    console.log("🔍 Buscando conversación existente para guestId:", guestId);
    let conversation = await Conversation.findOne({ guestId });
    
    if (!conversation) {
      console.log("📝 Creando nueva conversación para:", guestId);
      conversation = new Conversation({
        guestId,
        messages: []
      });
    } else {
      console.log("📋 Conversación existente encontrada, mensajes actuales:", conversation.messages.length);
    }

    const newMessage = {
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    console.log("📨 Agregando mensaje:", newMessage);
    conversation.messages.push(newMessage);

    // Mantener solo los últimos 50 mensajes para evitar documentos muy grandes
    if (conversation.messages.length > 50) {
      console.log("✂️ Recortando mensajes, había:", conversation.messages.length);
      conversation.messages = conversation.messages.slice(-50);
    }

    console.log("💾 Intentando guardar conversación...");
    const savedConversation = await conversation.save();
    console.log("✅ Conversación guardada exitosamente:", {
      id: savedConversation._id,
      guestId: savedConversation.guestId,
      totalMessages: savedConversation.messages.length
    });
    
  } catch (error) {
    console.error("❌ Error detallado guardando conversación:", {
      error: error.message,
      stack: error.stack,
      guestId,
      role,
      content: content?.substring(0, 50)
    });
  }
}

/**
 * Obtiene el historial de conversación de un huésped
 */
async function getConversationHistory(guestId, limit = 10) {
  console.log("🔍 DEBUG getConversationHistory para:", guestId);
  
  try {
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
        metadata: msg.metadata
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

    // Detectar si necesita soporte humano (muchas preguntas sin respuesta satisfactoria)
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

// Nueva función para debugging
async function debugConversations() {
  try {
    console.log("🔍 DEBUG: Verificando todas las conversaciones...");
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
    
    return { totalConversations, recentConversations };
  } catch (error) {
    console.error("❌ Error en debug:", error);
    return null;
  }
}

module.exports = {
  saveConversation,
  getConversationHistory,
  analyzeConversationPatterns,
  debugConversations
};