// src/domain/services/ConversationService.js
class ConversationService {
  constructor({ conversationRepository, aiService }) {
    this.conversationRepository = conversationRepository;
    this.aiService = aiService;
  }

  async addMessage(guestId, role, content, metadata = {}) {
    let conversation = await this.conversationRepository.findByGuestId(guestId);
    
    if (!conversation) {
      const { Conversation } = require('../entities/Conversation');
      conversation = new Conversation({ guestId });
    }

    conversation.addMessage(role, content, metadata);
    return await this.conversationRepository.save(conversation);
  }

  async getConversationHistory(guestId, limit = 10) {
    const conversation = await this.conversationRepository.findByGuestId(guestId);
    return conversation ? conversation.getRecentMessages(limit) : [];
  }
}

module.exports = { ConversationService };