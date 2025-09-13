// src/presentation/controllers/AdminController.js - Con import correcto
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class AdminController {
  constructor({
    conversationRepository,
    supportTicketRepository,
    listingRepository
  }) {
    this.conversationRepository = conversationRepository;
    this.supportTicketRepository = supportTicketRepository;
    this.listingRepository = listingRepository;
    this.logger = new SecureLogger();
  }

  async getStatistics(req, res) {
    try {
      const startTime = Date.now();
      
      // Get statistics from all repositories
      const [
        conversationStats,
        ticketStats,
        recentConversations,
        openTickets
      ] = await Promise.all([
        this.conversationRepository.getStatistics(),
        this.supportTicketRepository.getStatistics(),
        this.conversationRepository.findRecentActive(24),
        this.supportTicketRepository.findOpen()
      ]);

      const response = {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        conversations: {
          ...conversationStats,
          recent24h: recentConversations.length
        },
        supportTickets: {
          ...ticketStats,
          open: openTickets.length
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };

      this.logger.audit('Admin statistics accessed', {
        user: req.user?.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      this.logger.error('Failed to get admin statistics', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLogs(req, res) {
    try {
      const { 
        level, 
        limit = 100, 
        page = 1, 
        startDate, 
        endDate,
        source 
      } = req.query;

      // Construir filtros
      const filters = {};
      
      if (level) {
        filters.level = level;
      }
      
      if (source) {
        filters.source = source;
      }
      
      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = new Date(startDate);
        if (endDate) filters.timestamp.$lte = new Date(endDate);
      }

      // Obtener el modelo de logs
      const mongoose = require('mongoose');
      const LogModel = mongoose.models.SystemLog;
      
      if (!LogModel) {
        return res.status(503).json({
          success: false,
          error: 'Log system not initialized'
        });
      }

      const skip = (page - 1) * limit;
      
      const [logs, totalCount] = await Promise.all([
        LogModel.find(filters)
          .sort({ timestamp: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        LogModel.countDocuments(filters)
      ]);

      this.logger.audit('Admin logs accessed', {
        user: req.user?.id,
        ip: req.ip,
        filters,
        page,
        limit
      });

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            limit: parseInt(limit)
          },
          filters
        }
      });

    } catch (error) {
      this.logger.error('Failed to get logs', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getConversationDebug(req, res) {
    try {
      const recentConversations = await this.conversationRepository.findRecentActive(168); // 7 days
      
      const debugInfo = {
        totalConversations: recentConversations.length,
        conversationSummary: recentConversations.slice(0, 10).map(conv => ({
          guestId: conv.guestId,
          messageCount: conv.messages.length,
          lastActivity: conv.lastActivity,
          needsSupport: conv.summary.needsHumanSupport
        })),
        timestamp: new Date().toISOString()
      };

      this.logger.audit('Conversation debug accessed', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.json(debugInfo);

    } catch (error) {
      this.logger.error('Error getting conversation debug', { error: error.message });
      return res.status(500).json({ error: 'Failed to get debug information' });
    }
  }

  async testSaveConversation(req, res) {
    try {
      const { Conversation } = require('../../domain/entities/Conversation');
      
      const testGuestId = `debug-test-${Date.now()}`;
      const conversation = new Conversation({ guestId: testGuestId });
      
      conversation.addMessage('guest', 'Test message from admin endpoint');
      conversation.addMessage('agent', 'Test response from admin endpoint');
      
      const saved = await this.conversationRepository.save(conversation);
      
      this.logger.audit('Test conversation saved', {
        guestId: testGuestId,
        ip: req.ip
      });

      return res.json({
        success: true,
        testGuestId,
        messageCount: saved.messages.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Error testing conversation save', { error: error.message });
      return res.status(500).json({ error: 'Failed to test conversation save' });
    }
  }
}

module.exports = { AdminController };