// src/application/dto/WebhookDto.js
class WebhookDto {
  constructor(rawData) {
    this.event = this.extractEvent(rawData);
    this.reservationId = this.extractReservationId(rawData);
    this.conversationId = this.extractConversationId(rawData);
    this.messageId = this.extractMessageId(rawData);
    this.message = this.extractMessage(rawData);
    this.messageType = rawData.messageType;
    this.guestId = this.extractGuestId(rawData);
    this.listingMapId = this.extractListingMapId(rawData);
    this.timestamp = new Date();
  }

  extractEvent(data) {
    if (data.event) return data.event;
    if (data.event === 'messageCreated') return 'new message received';
    return 'unknown';
  }

  extractReservationId(data) {
    return data.reservationId || data.data?.reservationId;
  }

  extractConversationId(data) {
    return data.conversationId || data.data?.conversationId;
  }

  extractMessageId(data) {
    return data.messageId || data.data?.messageId;
  }

  extractMessage(data) {
    return data.message || data.data?.message;
  }

  extractGuestId(data) {
    return data.guestId || data.data?.guestId;
  }

  extractListingMapId(data) {
    return data.listingMapId || data.ListingMapId || data.data?.listingMapId || data.data?.ListingMapId;
  }

  validate() {
    const errors = [];
    
    if (!this.event) {
      errors.push('Event is required');
    }
    
    if (this.event === 'new message received' || this.event === 'messageCreated') {
      if (!this.reservationId) {
        errors.push('reservationId is required for message events');
      }
      if (!this.message) {
        errors.push('message is required for message events');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = { WebhookDto };