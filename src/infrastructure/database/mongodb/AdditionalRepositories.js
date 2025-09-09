// src/infrastructure/database/mongodb/AdditionalRepositories.js
const { SecureLogger } = require('../../../shared/logger/SecureLogger');
const { IFAQRepository } = require('../../../domain/repositories/IFAQRepository');
const { ISupportTicketRepository } = require('../../../domain/repositories/ISupportTicketRepository');
const { FAQ } = require('../../../domain/entities/FAQ');
const { SupportTicket } = require('../../../domain/entities/SupportTicket');
const { SupportTicketModel } = require('../models/SupportTicketModel');

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
    this.model = SupportTicketModel;
  }

  async save(ticket) {
    try {
      const id = Date.now().toString(); // Simple ID generation
      const newTicket = new this.model({ ...ticket, id });
      await newTicket.save();
      this.logger.info('Support ticket saved', { id });
      return newTicket.toObject();
    } catch (error) {
      this.logger.error('Error saving support ticket', { error: error.message });
      throw error;
    }
  }

  async findAll() {
    try {
      return await this.model.find().lean();
    } catch (error) {
      this.logger.error('Error finding all support tickets', { error: error.message });
      throw error;
    }
  }

  async findById(id) {
    try {
      return await this.model.findOne({ id }).lean();
    } catch (error) {
      this.logger.error('Error finding support ticket by id', { error: error.message, id });
      throw error;
    }
  }

  async findByGuestId(guestId) {
    try {
      return await this.model.find({ guestId }).lean();
    } catch (error) {
      this.logger.error('Error finding support tickets by guest id', { error: error.message, guestId });
      throw error;
    }
  }

  async findByReservationId(reservationId) {
    try {
      return await this.model.find({ reservationId }).lean();
    } catch (error) {
      this.logger.error('Error finding support tickets by reservation id', { error: error.message, reservationId });
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      return await this.model.find({ status }).lean();
    } catch (error) {
      this.logger.error('Error finding support tickets by status', { error: error.message, status });
      throw error;
    }
  }

  async findByPriority(priority) {
    try {
      return await this.model.find({ priority }).lean();
    } catch (error) {
      this.logger.error('Error finding support tickets by priority', { error: error.message, priority });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const updatedTicket = await this.model.findOneAndUpdate(
        { id },
        { ...updates, updatedAt: new Date() },
        { new: true }
      ).lean();
      return updatedTicket;
    } catch (error) {
      this.logger.error('Error updating support ticket', { error: error.message, id });
      throw error;
    }
  }

  async getStatistics() {
    try {
      const [
        total,
        open,
        resolved,
        highPriority,
        mediumPriority,
        lowPriority
      ] = await Promise.all([
        this.model.countDocuments(),
        this.model.countDocuments({ status: 'open' }),
        this.model.countDocuments({ status: 'resolved' }),
        this.model.countDocuments({ priority: 'high' }),
        this.model.countDocuments({ priority: 'medium' }),
        this.model.countDocuments({ priority: 'low' })
      ]);

      return {
        total,
        open,
        resolved,
        byPriority: {
          high: highPriority,
          medium: mediumPriority,
          low: lowPriority
        }
      };
    } catch (error) {
      this.logger.error('Error getting support ticket statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = {
  MongoFAQRepository,
  MongoSupportTicketRepository
};