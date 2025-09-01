/ src/infraestructure/database/mongodb/AdditionalRepositories.js
const { SecureLogger } = require('../../../shared/logger/SecureLogger');
const { IFAQRepository } = require('../../../domain/repositories/IFAQRepository');
const { ISupportTicketRepository } = require('../../../domain/repositories/ISupportTicketRepository');
const { FAQ } = require('../../../domain/entities/FAQ');
const { SupportTicket } = require('../../../domain/entities/SupportTicket');

// FAQ Repository Implementation
class MongoFAQRepository extends IFAQRepository {
  constructor() {
    super();
    this.logger = new SecureLogger();
    this.faqs = []; // In-memory storage for now - replace with MongoDB collection
  }

  async findAll() {
    try {
      this.logger.debug('Finding all FAQs');
      return this.faqs;
    } catch (error) {
      this.logger.error('Error finding all FAQs', { error: error.message });
      throw error;
    }
  }

  async findById(id) {
    try {
      const faq = this.faqs.find(f => f.id === id);
      return faq || null;
    } catch (error) {
      this.logger.error('Error finding FAQ by id', { error: error.message, id });
      throw error;
    }
  }

  async search(query) {
    try {
      this.logger.debug('Searching FAQs', { query });
      return this.faqs.filter(faq => faq.isRelevantTo(query));
    } catch (error) {
      this.logger.error('Error searching FAQs', { error: error.message, query });
      throw error;
    }
  }

  async findByCategory(category) {
    try {
      return this.faqs.filter(faq => faq.category === category);
    } catch (error) {
      this.logger.error('Error finding FAQs by category', { error: error.message, category });
      throw error;
    }
  }

  async save(faq) {
    try {
      if (!faq.id) {
        faq.id = Date.now().toString(); // Simple ID generation
      }
      
      const existingIndex = this.faqs.findIndex(f => f.id === faq.id);
      if (existingIndex >= 0) {
        this.faqs[existingIndex] = faq;
      } else {
        this.faqs.push(faq);
      }
      
      this.logger.info('FAQ saved', { id: faq.id });
      return faq;
    } catch (error) {
      this.logger.error('Error saving FAQ', { error: error.message });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const faqIndex = this.faqs.findIndex(f => f.id === id);
      if (faqIndex >= 0) {
        this.faqs[faqIndex].update(updates);
        return this.faqs[faqIndex];
      }
      return null;
    } catch (error) {
      this.logger.error('Error updating FAQ', { error: error.message, id });
      throw error;
    }
  }

  async delete(id) {
    try {
      const faqIndex = this.faqs.findIndex(f => f.id === id);
      if (faqIndex >= 0) {
        this.faqs.splice(faqIndex, 1);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error deleting FAQ', { error: error.message, id });
      throw error;
    }
  }
}

// Support Ticket Repository Implementation
class MongoSupportTicketRepository extends ISupportTicketRepository {
  constructor() {
    super();
    this.logger = new SecureLogger();
    this.tickets = []; // In-memory storage for now - replace with MongoDB collection
  }

  async save(ticket) {
    try {
      if (!ticket.id) {
        ticket.id = Date.now().toString(); // Simple ID generation
      }
      
      const existingIndex = this.tickets.findIndex(t => t.id === ticket.id);
      if (existingIndex >= 0) {
        this.tickets[existingIndex] = ticket;
      } else {
        this.tickets.push(ticket);
      }
      
      this.logger.info('Support ticket saved', { id: ticket.id });
      return ticket;
    } catch (error) {
      this.logger.error('Error saving support ticket', { error: error.message });
      throw error;
    }
  }

  async findById(id) {
    try {
      const ticket = this.tickets.find(t => t.id === id);
      return ticket || null;
    } catch (error) {
      this.logger.error('Error finding support ticket by id', { error: error.message, id });
      throw error;
    }
  }

  async findByGuestId(guestId) {
    try {
      return this.tickets.filter(t => t.guestId === guestId);
    } catch (error) {
      this.logger.error('Error finding support tickets by guestId', { error: error.message, guestId });
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      return this.tickets.filter(t => t.status === status);
    } catch (error) {
      this.logger.error('Error finding support tickets by status', { error: error.message, status });
      throw error;
    }
  }

  async findByPriority(priority) {
    try {
      return this.tickets.filter(t => t.priority === priority);
    } catch (error) {
      this.logger.error('Error finding support tickets by priority', { error: error.message, priority });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const ticketIndex = this.tickets.findIndex(t => t.id === id);
      if (ticketIndex >= 0) {
        Object.assign(this.tickets[ticketIndex], updates);
        this.tickets[ticketIndex].updatedAt = new Date();
        return this.tickets[ticketIndex];
      }
      return null;
    } catch (error) {
      this.logger.error('Error updating support ticket', { error: error.message, id });
      throw error;
    }
  }

  async getStatistics() {
    try {
      const total = this.tickets.length;
      const open = this.tickets.filter(t => t.isOpen()).length;
      const resolved = this.tickets.filter(t => t.isResolved()).length;
      const byPriority = {
        high: this.tickets.filter(t => t.priority === 'high').length,
        medium: this.tickets.filter(t => t.priority === 'medium').length,
        low: this.tickets.filter(t => t.priority === 'low').length
      };

      return {
        total,
        open,
        resolved,
        byPriority
      };
    } catch (error) {
      this.logger.error('Error getting support ticket statistics', { error: error.message });
      throw error;
    }
  }

  async findOpen() {
    try {
      return this.tickets.filter(t => t.isOpen());
    } catch (error) {
      this.logger.error('Error finding open support tickets', { error: error.message });
      throw error;
    }
  }
}

module.exports = {
  MongoFAQRepository,
  MongoSupportTicketRepository
};