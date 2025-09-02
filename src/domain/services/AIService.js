// src/domain/services/AIService.js
class AIService {
  async detectField(message, conversationHistory) {
    throw new Error('Method detectField must be implemented');
  }

  async generateFriendlyResponse(question, answer, conversationHistory) {
    throw new Error('Method generateFriendlyResponse must be implemented');
  }

  async generateFallbackResponse(message, conversationHistory, context) {
    throw new Error('Method generateFallbackResponse must be implemented');
  }

  async searchFAQs(question, faqsText) {
    throw new Error('Method searchFAQs must be implemented');
  }

  async ask(prompt, options) {
    throw new Error('Method ask must be implemented');
  }
}

module.exports = { AIService };