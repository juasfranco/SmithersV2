// src/presentation/controllers/HealthController.js
class HealthController {
  constructor({ 
    databaseConnection, 
    hostawayService, 
    aiService,
    conversationRepository,
    listingRepository 
  }) {
    this.databaseConnection = databaseConnection;
    this.hostawayService = hostawayService;
    this.aiService = aiService;
    this.conversationRepository = conversationRepository;
    this.listingRepository = listingRepository;
    this.logger = new SecureLogger();
  }

  async getHealthStatus(req, res) {
    try {
      const startTime = Date.now();
      
      // Check all dependencies
      const [
        databaseHealth,
        hostawayHealth,
        aiHealth
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkHostaway(),
        this.checkAI()
      ]);

      const isHealthy = [databaseHealth, hostawayHealth, aiHealth]
        .every(result => result.status === 'fulfilled' && result.value.healthy);

      const response = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        processingTime: Date.now() - startTime,
        services: {
          database: this.getServiceStatus(databaseHealth),
          hostaway: this.getServiceStatus(hostawayHealth),
          ai: this.getServiceStatus(aiHealth)
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };

      return res.status(isHealthy ? 200 : 503).json(response);

    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkDatabase() {
    try {
      const health = await this.databaseConnection.healthCheck();
      
      // Test a simple query
      const testResult = await this.conversationRepository.getStatistics();
      
      return {
        healthy: health.healthy && typeof testResult === 'object',
        ...health,
        testQuery: 'passed'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkHostaway() {
    try {
      const isConnected = await this.hostawayService.testConnection();
      
      return {
        healthy: isConnected,
        status: isConnected ? 'connected' : 'disconnected'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkAI() {
    try {
      const testResponse = await this.aiService.ask('Test connection');
      
      return {
        healthy: !!testResponse && testResponse.length > 0,
        status: 'connected'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  getServiceStatus(promiseResult) {
    if (promiseResult.status === 'fulfilled') {
      return promiseResult.value;
    } else {
      return {
        healthy: false,
        error: promiseResult.reason?.message || 'Unknown error'
      };
    }
  }
}