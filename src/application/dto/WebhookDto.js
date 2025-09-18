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
    // Direct event field
    if (data.event) {
      // Normalize common Hostaway events
      const eventMappings = {
        'messageCreated': 'new message received',
        'conversation_message_created': 'new message received',
        'message_created': 'new message received',
        'new_message': 'new message received',
        'reservation_created': 'reservation created',
        'reservation_updated': 'reservation updated'
      };
      
      return eventMappings[data.event] || data.event;
    }
    
    // Hostaway specific format detection
    if (data.isIncoming === 1 && (data.body || data.message)) {
      return 'new message received';
    }
    
    // Try to infer event from data structure
    if (data.message || data.data?.message || data.body) {
      return 'new message received';
    }
    
    if (data.reservationId || data.data?.reservationId) {
      if (data.action === 'created' || data.type === 'created') {
        return 'reservation created';
      }
      if (data.action === 'updated' || data.type === 'updated') {
        return 'reservation updated';
      }
    }
    
    // Log unknown events for debugging
    console.log('🔍 Unknown webhook event structure:', JSON.stringify(data, null, 2));
    
    return 'unknown';
  }

  extractReservationId(data) {
    return data.reservationId || 
           data.reservation_id || 
           data.data?.reservationId || 
           data.data?.reservation_id ||
           data.object?.reservationId ||
           data.object?.reservation_id;
  }

  extractConversationId(data) {
    return data.conversationId || 
           data.conversation_id || 
           data.data?.conversationId || 
           data.data?.conversation_id ||
           data.object?.conversationId ||
           data.object?.conversation_id;
  }

  extractMessageId(data) {
    return data.messageId || 
           data.id ||  // Hostaway uses 'id' for message ID
           data.message_id || 
           data.data?.messageId || 
           data.data?.message_id ||
           data.data?.id ||
           data.object?.messageId ||
           data.object?.message_id ||
           data.object?.id;
  }

  extractMessage(data) {
    return data.message || 
           data.body ||  // Hostaway uses 'body' for message content
           data.data?.message || 
           data.object?.message ||
           data.text ||
           data.data?.text ||
           data.object?.text;
  }

  extractGuestId(data) {
    return data.guestId || 
           data.guest_id || 
           data.data?.guestId || 
           data.data?.guest_id ||
           data.object?.guestId ||
           data.object?.guest_id ||
           data.guestEmail ||
           data.data?.guestEmail ||
           data.object?.guestEmail ||
           // For Hostaway, we can use reservationId as fallback for guestId
           (data.reservationId ? `guest-${data.reservationId}` : null);
  }

  extractListingMapId(data) {
    return data.listingMapId || 
           data.listing_map_id ||
           data.ListingMapId || 
           data.data?.listingMapId || 
           data.data?.listing_map_id ||
           data.data?.ListingMapId ||
           data.object?.listingMapId ||
           data.object?.listing_map_id ||
           data.object?.ListingMapId;
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
        errors.push('message content is required for message events');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = { WebhookDto };