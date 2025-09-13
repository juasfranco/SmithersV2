// src/domain/entities/Conversation.js
class Conversation {
  constructor({ guestId, messages = [], lastActivity = new Date(), summary = {} }) {
    this.validateGuestId(guestId);
    
    this.guestId = guestId;
    this.messages = messages.map(msg => this.createMessage(msg));
    this.lastActivity = lastActivity;
    this.summary = {
      totalMessages: summary.totalMessages || messages.length,
      needsHumanSupport: summary.needsHumanSupport || false,
      commonTopics: summary.commonTopics || [],
      satisfactionScore: summary.satisfactionScore || null
    };
  }

  addMessage(role, content, metadata = {}) {
    this.validateRole(role);
    this.validateContent(content);
    
    const message = this.createMessage({ role, content, metadata });
    this.messages.push(message);
    this.updateActivity();
    this.trimMessages();
    
    return message;
  }

  createMessage({ role, content, timestamp = new Date(), metadata = {} }) {
    return {
      role,
      content: this.sanitizeContent(content),
      timestamp,
      metadata: this.sanitizeMetadata(metadata)
    };
  }

  updateActivity() {
    this.lastActivity = new Date();
    this.summary.totalMessages = this.messages.length;
  }

  trimMessages(maxMessages = 50) {
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(-maxMessages);
    }
  }

  getRecentMessages(count = 10) {
    return this.messages.slice(-count);
  }

  validateGuestId(guestId) {
    if (!guestId || typeof guestId !== 'string' || guestId.trim().length === 0) {
      throw new Error('GuestId is required and must be a non-empty string');
    }
  }

  validateRole(role) {
    const validRoles = ['guest', 'agent'];
    if (!validRoles.includes(role)) {
      throw new Error(`Role must be one of: ${validRoles.join(', ')}`);
    }
  }

  validateContent(content) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content is required and must be a non-empty string');
    }
  }

  sanitizeContent(content) {
    return content.toString().trim().substring(0, 5000); // Limit content length
  }

  sanitizeMetadata(metadata) {
    const sanitized = {};
    const allowedKeys = [
      'source', 'detectedField', 'listingMapId', 'confidence', 
      'processingTime', 'reservationId', 'conversationId', 
      'messageId', 'hostaway', 'context'
    ];
    
    allowedKeys.forEach(key => {
      if (metadata[key] !== undefined) {
        sanitized[key] = metadata[key];
      }
    });
    
    return sanitized;
  }
}

module.exports = { Conversation };