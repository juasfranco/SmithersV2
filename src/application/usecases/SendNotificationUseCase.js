// src/application/usecases/SendNotificationUseCase.js
class SendNotificationUseCase {
  constructor({
    supportTicketRepository,
    whatsappService,
    emailService
  }) {
    this.supportTicketRepository = supportTicketRepository;
    this.whatsappService = whatsappService;
    this.emailService = emailService;
    this.logger = new SecureLogger();
  }

  async execute({
    type = 'support',
    guestId,
    reservationId,
    listingMapId,
    message,
    priority = 'medium',
    error = null,
    metadata = {}
  }) {
    try {
      this.logger.info('Sending notification', {
        type,
        guestId,
        priority
      });

      // 1. Create support ticket if needed
      let ticket = null;
      if (type === 'support' || type === 'error') {
        const { SupportTicket } = require('../../domain/entities/SupportTicket');
        
        ticket = new SupportTicket({
          guestId,
          reservationId,
          listingMapId,
          question: message,
          reason: error || 'Support request from AI agent',
          priority,
          metadata: {
            ...metadata,
            error,
            notificationType: type
          }
        });

        await this.supportTicketRepository.save(ticket);
        this.logger.info('Support ticket created', { ticketId: ticket.id });
      }

      // 2. Send WhatsApp notification
      if (this.whatsappService) {
        try {
          await this.whatsappService.sendNotification({
            guestId,
            reservationId,
            message,
            priority,
            type,
            ticketId: ticket?.id
          });
          
          this.logger.info('WhatsApp notification sent');
        } catch (whatsappError) {
          this.logger.error('WhatsApp notification failed', { 
            error: whatsappError.message 
          });
        }
      }

      // 3. Send email notification for high priority
      if (priority === 'high' && this.emailService) {
        try {
          await this.emailService.sendNotification({
            guestId,
            reservationId,
            message,
            priority,
            type,
            ticketId: ticket?.id
          });
          
          this.logger.info('Email notification sent');
        } catch (emailError) {
          this.logger.error('Email notification failed', { 
            error: emailError.message 
          });
        }
      }

      return {
        success: true,
        ticketId: ticket?.id,
        notificationsSent: {
          whatsapp: !!this.whatsappService,
          email: priority === 'high' && !!this.emailService
        }
      };

    } catch (error) {
      this.logger.error('Notification sending failed', {
        error: error.message,
        type,
        guestId
      });
      
      throw error;
    }
  }
}
