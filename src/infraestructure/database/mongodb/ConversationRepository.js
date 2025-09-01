// src/infrastructure/database/mongodb/ConversationRepository.js
const { IConversationRepository } = require('../../../domain/repositories/IConversationRepository');
const { Conversation } = require('../../../domain/entities/Conversation');
const ConversationModel = require('./models/ConversationModel');

class MongoConversationRepository extends IConversationRepository {
  constructor() {
    super();
    this.logger = new SecureLogger();
  }

  async save(conversation) {
    try {
      this.logger.debug('Saving conversation', { guestId: conversation.guestId });

      const existingDoc = await ConversationModel.findOne({ guestId: conversation.guestId });
      
      if (existingDoc) {
        existingDoc.messages = conversation.messages;
        existingDoc.lastActivity = conversation.lastActivity;
        existingDoc.summary = conversation.summary;
        
        const saved = await existingDoc.save();
        this.logger.info('Conversation updated', { id: saved._id, guestId: conversation.guestId });
        return this.toDomainEntity(saved);
      } else {
        const newDoc = new ConversationModel({
          guestId: conversation.guestId,
          messages: conversation.messages,
          lastActivity: conversation.lastActivity,
          summary: conversation.summary
        });
        
        const saved = await newDoc.save();
        this.logger.info('New conversation created', { id: saved._id, guestId: conversation.guestId });
        return this.toDomainEntity(saved);
      }
    } catch (error) {
      this.logger.error('Error saving conversation', { 
        error: error.message, 
        guestId: conversation.guestId 
      });
      throw error;
    }
  }

  async findByGuestId(guestId) {
    try {
      const doc = await ConversationModel.findOne({ guestId }).lean();
      return doc ? this.toDomainEntity(doc) : null;
    } catch (error) {
      this.logger.error('Error finding conversation by guestId', { 
        error: error.message, 
        guestId 
      });
      throw error;
    }
  }

  async findById(id) {
    try {
      const doc = await ConversationModel.findById(id).lean();
      return doc ? this.toDomainEntity(doc) : null;
    } catch (error) {
      this.logger.error('Error finding conversation by id', { error: error.message, id });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const doc = await ConversationModel.findByIdAndUpdate(
        id, 
        { ...updates, updatedAt: new Date() }, 
        { new: true }
      );
      return doc ? this.toDomainEntity(doc) : null;
    } catch (error) {
      this.logger.error('Error updating conversation', { error: error.message, id });
      throw error;
    }
  }

  async delete(id) {
    try {
      const result = await ConversationModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      this.logger.error('Error deleting conversation', { error: error.message, id });
      throw error;
    }
  }

  async findRecentActive(hours = 24) {
    try {
      const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const docs = await ConversationModel.find({
        lastActivity: { $gte: cutoff }
      }).lean();
      
      return docs.map(doc => this.toDomainEntity(doc));
    } catch (error) {
      this.logger.error('Error finding recent active conversations', { error: error.message });
      throw error;
    }
  }

  async getStatistics() {
    try {
      const stats = await ConversationModel.aggregate([
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            averageMessages: { $avg: '$summary.totalMessages' },
            needingSupport: {
              $sum: {
                $cond: ['$summary.needsHumanSupport', 1, 0]
              }
            }
          }
        }
      ]);

      return stats[0] || {
        totalConversations: 0,
        averageMessages: 0,
        needingSupport: 0
      };
    } catch (error) {
      this.logger.error('Error getting conversation statistics', { error: error.message });
      throw error;
    }
  }

  toDomainEntity(doc) {
    return new Conversation({
      guestId: doc.guestId,
      messages: doc.messages || [],
      lastActivity: doc.lastActivity,
      summary: doc.summary || {}
    });
  }
}
