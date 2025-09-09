// src/application/usecases/ProcessWebhookUseCase.js - Con import correcto
const { Validator } = require('../../infrastructure/security/Validator');
const { SecureLogger } = require('../../shared/logger/SecureLogger');

/**
 * @class ProcessWebhookUseCase
 * @description Use case for processing Hostaway webhooks
 */
class ProcessWebhookUseCase {
  constructor({
    conversationRepository,
    reservationRepository,
    listingRepository,
    generateResponseUseCase,
    sendNotificationUseCase,
    hostawayService
  }) {
    this.conversationRepository = conversationRepository;
    this.reservationRepository = reservationRepository;
    this.listingRepository = listingRepository;
    this.generateResponseUseCase = generateResponseUseCase;
    this.sendNotificationUseCase = sendNotificationUseCase;
    this.hostawayService = hostawayService;
    this.logger = new SecureLogger();
  }

  async execute(webhookData) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Processing webhook', { 
        event: webhookData.event,
        reservationId: webhookData.reservationId 
      });

      // 1. Validate webhook payload
      const validation = Validator.validateWebhookPayload(webhookData);
      if (!validation.isValid) {
        throw new Error(`Invalid webhook payload: ${validation.errors.join(', ')}`);
      }

      // 2. Process based on event type
      let result;
      switch (webhookData.event) {
        case 'new message received':
        case 'messageCreated':
        case 'conversation_message_created':
          result = await this.processNewMessage(webhookData);
          break;
        case 'reservation created':
        case 'reservation_created':
          result = await this.processReservationCreated(webhookData);
          break;
        case 'reservation updated':
        case 'reservation_updated':
          result = await this.processReservationUpdated(webhookData);
          break;
        default:
          this.logger.info('Unhandled webhook event', { event: webhookData.event });
          result = { success: true, message: 'Event received but not processed' };
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Webhook processed successfully', { 
        event: webhookData.event,
        processingTime 
      });

      return {
        ...result,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Webhook processing failed', {
        error: error.message,
        event: webhookData.event,
        processingTime
      });

      // Send error notification for critical failures
      await this.sendNotificationUseCase.execute({
        type: 'error',
        guestId: webhookData.guestId || 'unknown',
        reservationId: webhookData.reservationId || 'unknown',
        message: `Webhook processing failed: ${error.message}`,
        priority: 'high'
      });

      throw error;
    }
  }

  async processNewMessage(webhookData) {
    const { reservationId, conversationId, message, guestId, listingMapId } = webhookData;

    // 1. Get complete context from Hostaway
    const context = await this.hostawayService.getCompleteContext(reservationId, conversationId);
    
    // 2. Enrich data
    const enrichedGuestId = guestId || context.reservation.guestEmail || `guest-${reservationId}`;
    const enrichedListingMapId = listingMapId || context.reservation.listingMapId;

    // 3. Save guest message to conversation history
    let conversation = await this.conversationRepository.findByGuestId(enrichedGuestId);
    if (!conversation) {
      const { Conversation } = require('../../domain/entities/Conversation');
      conversation = new Conversation({ guestId: enrichedGuestId });
    }

    conversation.addMessage('guest', message, {
      reservationId,
      conversationId,
      hostaway: true,
      context: {
        guestName: context.reservation.guestName,
        listingName: context.listing?.name,
        checkInDate: context.reservation.checkInDate
      }
    });

    await this.conversationRepository.save(conversation);

    // 4. Generate AI response
    const responseResult = await this.generateResponseUseCase.execute({
      message,
      listingMapId: enrichedListingMapId,
      guestId: enrichedGuestId,
      reservationId,
      context
    });

    // 5. Send response through Hostaway
    const sentMessage = await this.hostawayService.sendMessageToGuest(reservationId, responseResult.response);

    if (sentMessage) {
      // 6. Save agent response to conversation history
      conversation.addMessage('agent', responseResult.response, {
        source: responseResult.source,
        processingTime: responseResult.processingTime,
        hostawayMessageId: sentMessage.id,
        hostaway: true
      });

      await this.conversationRepository.save(conversation);

      return {
        success: true,
        context: {
          reservationId,
          guestName: context.reservation.guestName,
          listingName: context.listing?.name,
          responseSource: responseResult.source
        }
      };
    } else {
      throw new Error('Failed to send message through Hostaway');
    }
  }

  async processReservationCreated(webhookData) {
    const { reservationId } = webhookData;
    
    this.logger.info('New reservation created', { reservationId });
    
    // Could implement welcome message automation here
    return {
      success: true,
      message: 'Reservation created notification processed'
    };
  }

  async processReservationUpdated(webhookData) {
    const { reservationId, changes } = webhookData;
    
    this.logger.info('Reservation updated', { reservationId, changes });
    
    // Could implement update notifications here
    return {
      success: true,
      message: 'Reservation updated notification processed'
    };
  }
}

// Export the ProcessWebhookUseCase class
class ProcessWebhookUseCaseImpl extends ProcessWebhookUseCase {}
module.exports = { ProcessWebhookUseCase: ProcessWebhookUseCaseImpl };