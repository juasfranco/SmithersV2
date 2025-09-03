// src/application/usecases/CreateSupportTicketUseCase.js
const { SupportTicket } = require('../../domain/entities/SupportTicket');
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class CreateSupportTicketUseCase {
  constructor({
    supportTicketRepository,
    sendNotificationUseCase
  }) {
    this.supportTicketRepository = supportTicketRepository;
    this.sendNotificationUseCase = sendNotificationUseCase;
    this.logger = new SecureLogger();
  }

  async execute({
    guestId,
    reservationId,
    listingMapId,
    question,
    reason,
    priority = 'medium',
    metadata = {}
  }) {
    try {
      this.logger.info('Creating support ticket', {
        guestId,
        reservationId,
        reason
      });

      // 1. Create ticket entity
      const ticket = new SupportTicket({
        guestId,
        reservationId,
        listingMapId,
        question,
        reason,
        priority,
        metadata: {
          ...metadata,
          aiAttempted: true,
          createdAt: new Date()
        }
      });

      // 2. Save ticket
      const savedTicket = await this.supportTicketRepository.save(ticket);

      // 3. Notify support team
      await this.sendNotificationUseCase.execute({
        type: 'support_ticket_created',
        data: {
          ticketId: savedTicket.id,
          guestId,
          reservationId,
          reason,
          priority
        }
      });

      this.logger.info('Support ticket created successfully', {
        ticketId: savedTicket.id,
        guestId,
        priority
      });

      return {
        success: true,
        ticketId: savedTicket.id,
        ticket: savedTicket
      };

    } catch (error) {
      this.logger.error('Failed to create support ticket', {
        error: error.message,
        guestId,
        reservationId
      });
      throw error;
    }
  }
}

module.exports = { CreateSupportTicketUseCase };
