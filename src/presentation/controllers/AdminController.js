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
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.json(response);

    } catch (error) {
      this.logger.error('Error getting statistics', { error: error.message });
      return res.status(500).json({ error: 'Failed to get statistics' });
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
