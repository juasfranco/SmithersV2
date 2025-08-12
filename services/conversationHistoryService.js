// services/conversationHistoryService.js
const Conversation = require("../models/conversation");

/**
 * Guarda un mensaje en el historial de conversación
 */
async function saveConversation(guestId, role, content, metadata = {}) {
  try {
    let conversation = await Conversation.findOne({ guestId });
    
    if (!conversation) {
      conversation = new Conversation({
        guestId,
        messages: []
      });
    }

    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    // Mantener solo los últimos 50 mensajes para evitar documentos muy grandes
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    await conversation.save();
    console.log(`💾 Mensaje guardado para guest ${guestId} (${role})`);
    
  } catch (error) {
    console.error("❌ Error guardando conversación:", error);
  }
}

/**
 * Obtiene el historial de conversación de un huésped
 */
async function getConversationHistory(guestId, limit = 10) {
  try {
    const conversation = await Conversation.findOne({ guestId });
    if (!conversation || !conversation.messages) {
      return [];
    }

    return conversation.messages
      .slice(-limit)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      }));
      
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

module.exports = {
  saveConversation,
  getConversationHistory,
  analyzeConversationPatterns
};