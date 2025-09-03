// src/config/DependencyContainer.js
const { SecureLogger } = require('../shared/logger/SecureLogger');
const { Validator } = require('../infraestructure/secutiry/Validator');

// Database
const { DatabaseConnection } = require('../infraestructure/database/mongodb/Connection');
const { MongoListingRepository } = require('../infraestructure/database/mongodb/ListingRepository');
const { MongoConversationRepository } = require('../infraestructure/database/mongodb/ConversationRepository');
const { MongoFAQRepository, MongoSupportTicketRepository } = require('../infraestructure/database/mongodb/AdditionalRepositories');

// External Services
const { HostawayService } = require('../infraestructure/external/hostaway/HostawayService');
const { OpenAIService } = require('../infraestructure/external/openai/OpenAIService');
const { WhatsAppService } = require('../infraestructure/external/whatsapp/WhatsAppService');

// Security - IMPORTS CORREGIDOS
const { RateLimiter } = require('../infraestructure/secutiry/RateLimiter');
const { TokenManager } = require('../infraestructure/secutiry/TokenManager');

// Use Cases
const { ProcessWebhookUseCase } = require('../application/usecases/ProcessWebhookUseCase');
const { GenerateResponseUseCase } = require('../application/usecases/GenerateResponseUseCase');
const { SendNotificationUseCase } = require('../application/usecases/SendNotificationUseCase');

// Controllers
const { WebhookController } = require('../presentation/controllers/WebhookController');
const { HealthController } = require('../presentation/controllers/HealthController');
const { AdminController } = require('../presentation/controllers/AdminController');

// Middleware
const { AuthMiddleware } = require('../presentation/middleware/AuthMiddleware');
const { ErrorMiddleware } = require('../presentation/middleware/ErrorMiddleware');
const { ValidationMiddleware } = require('../presentation/middleware/ValidationMiddleware');

class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.logger = new SecureLogger();
  }

  async initialize() {
    try {
      this.logger.info('Initializing dependency container...');

      // 1. Validate environment
      Validator.validateEnvironmentVariables();

      // 2. Initialize infrastructure
      await this.initializeInfrastructure();

      // 3. Initialize repositories
      this.initializeRepositories();

      // 4. Initialize services
      await this.initializeServices();

      // 5. Initialize use cases
      this.initializeUseCases();

      // 6. Initialize controllers
      this.initializeControllers();

      // 7. Initialize middleware
      this.initializeMiddleware();

      this.logger.info('✅ Dependency container initialized successfully');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize dependency container', { error: error.message });
      throw error;
    }
  }

  async initializeInfrastructure() {
    this.logger.debug('Initializing infrastructure...');

    // Database connection
    const databaseConnection = new DatabaseConnection();
    await databaseConnection.connect(process.env.MONGODB_URI);
    this.dependencies.set('databaseConnection', databaseConnection);

    // Security components
    const rateLimiter = new RateLimiter();
    this.dependencies.set('rateLimiter', rateLimiter);

    const tokenManager = new TokenManager();
    this.dependencies.set('tokenManager', tokenManager);

    this.logger.debug('Infrastructure initialized');
  }

  initializeRepositories() {
    this.logger.debug('Initializing repositories...');

    const listingRepository = new MongoListingRepository();
    this.dependencies.set('listingRepository', listingRepository);

    const conversationRepository = new MongoConversationRepository();
    this.dependencies.set('conversationRepository', conversationRepository);

    const faqRepository = new MongoFAQRepository();
    this.dependencies.set('faqRepository', faqRepository);

    const supportTicketRepository = new MongoSupportTicketRepository();
    this.dependencies.set('supportTicketRepository', supportTicketRepository);

    this.logger.debug('Repositories initialized');
  }

  async initializeServices() {
    this.logger.debug('Initializing external services...');

    // Hostaway service
    const hostawayService = new HostawayService();
    await hostawayService.initialize();
    this.dependencies.set('hostawayService', hostawayService);

    // OpenAI service
    const aiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.dependencies.set('aiService', aiService);

    // WhatsApp service (optional)
    if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
      const whatsappService = new WhatsAppService({
        apiUrl: process.env.WHATSAPP_API_URL,
        apiToken: process.env.WHATSAPP_API_TOKEN,
        phoneNumber: process.env.WHATSAPP_PHONE_NUMBER
      });
      this.dependencies.set('whatsappService', whatsappService);
    }

    this.logger.debug('External services initialized');
  }

  initializeUseCases() {
    this.logger.debug('Initializing use cases...');

    // Generate Response Use Case
    const generateResponseUseCase = new GenerateResponseUseCase({
      listingRepository: this.get('listingRepository'),
      faqRepository: this.get('faqRepository'),
      conversationRepository: this.get('conversationRepository'),
      aiService: this.get('aiService')
    });
    this.dependencies.set('generateResponseUseCase', generateResponseUseCase);

    // Send Notification Use Case
    const sendNotificationUseCase = new SendNotificationUseCase({
      supportTicketRepository: this.get('supportTicketRepository'),
      whatsappService: this.get('whatsappService'),
      emailService: null // TODO: Implement email service
    });
    this.dependencies.set('sendNotificationUseCase', sendNotificationUseCase);

    // Process Webhook Use Case
    const processWebhookUseCase = new ProcessWebhookUseCase({
      conversationRepository: this.get('conversationRepository'),
      reservationRepository: null, // TODO: Implement if needed
      listingRepository: this.get('listingRepository'),
      generateResponseUseCase,
      sendNotificationUseCase,
      hostawayService: this.get('hostawayService')
    });
    this.dependencies.set('processWebhookUseCase', processWebhookUseCase);

    this.logger.debug('Use cases initialized');
  }

  initializeControllers() {
    this.logger.debug('Initializing controllers...');

    // Health Controller
    const healthController = new HealthController({
      databaseConnection: this.get('databaseConnection'),
      hostawayService: this.get('hostawayService'),
      aiService: this.get('aiService'),
      conversationRepository: this.get('conversationRepository'),
      listingRepository: this.get('listingRepository')
    });
    this.dependencies.set('healthController', healthController);

    // Webhook Controller
    const webhookController = new WebhookController({
      processWebhookUseCase: this.get('processWebhookUseCase'),
      rateLimiter: this.get('rateLimiter')
    });
    this.dependencies.set('webhookController', webhookController);

    // Admin Controller
    const adminController = new AdminController({
      conversationRepository: this.get('conversationRepository'),
      supportTicketRepository: this.get('supportTicketRepository'),
      listingRepository: this.get('listingRepository')
    });
    this.dependencies.set('adminController', adminController);

    this.logger.debug('Controllers initialized');
  }

  initializeMiddleware() {
    this.logger.debug('Initializing middleware...');

    const authMiddleware = new AuthMiddleware();
    this.dependencies.set('authMiddleware', authMiddleware);

    const errorMiddleware = new ErrorMiddleware();
    this.dependencies.set('errorMiddleware', errorMiddleware);

    const validationMiddleware = new ValidationMiddleware();
    this.dependencies.set('validationMiddleware', validationMiddleware);

    this.logger.debug('Middleware initialized');
  }

  get(name) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found in container`);
    }
    return dependency;
  }

  async healthCheck() {
    const results = {};
    
    try {
      const databaseConnection = this.get('databaseConnection');
      results.database = await databaseConnection.healthCheck();
    } catch (error) {
      results.database = { healthy: false, error: error.message };
    }

    try {
      const hostawayService = this.get('hostawayService');
      results.hostaway = await hostawayService.healthCheck();
    } catch (error) {
      results.hostaway = { healthy: false, error: error.message };
    }

    try {
      const aiService = this.get('aiService');
      results.ai = await aiService.healthCheck();
    } catch (error) {
      results.ai = { healthy: false, error: error.message };
    }

    return results;
  }

  async shutdown() {
    this.logger.info('Shutting down dependency container...');

    try {
      // Shutdown in reverse order
      const shutdownOrder = [
        'hostawayService',
        'databaseConnection'
      ];

      for (const depName of shutdownOrder) {
        try {
          const dependency = this.dependencies.get(depName);
          if (dependency && typeof dependency.shutdown === 'function') {
            await dependency.shutdown();
            this.logger.debug(`${depName} shut down`);
          }
        } catch (error) {
          this.logger.error(`Error shutting down ${depName}`, { error: error.message });
        }
      }

      this.dependencies.clear();
      this.logger.info('Dependency container shutdown completed');

    } catch (error) {
      this.logger.error('Error during dependency container shutdown', { error: error.message });
    }
  }
}

module.exports = { DependencyContainer };