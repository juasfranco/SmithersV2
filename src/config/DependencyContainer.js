
// src/config/DependencyContainer.js
const { Validator } = require('../infraestructure/secutiry/Validator');
const { RateLimiter } = require('../infraestructure/secutiry/RateLimiter');
const { TokenManager } = require('../infraestructure/secutiry/TokenManager');
const { SecurityHeaders } = require('../infraestructure/secutiry/SecurityHeaders');
const { SecureLogger } = require('../shared/logger/SecureLogger');

// Infrastructure - Database
const { DatabaseConnection } = require('../infraestructure/database/mongodb/Connection');
const { MongoConversationRepository } = require('../infraestructure/database/mongodb/ConversationRepository');
const { MongoListingRepository } = require('../infraestructure/database/mongodb/ListingRepository');

// Infrastructure - External Services
const { HostawayService } = require('../infraestructure/external/hostaway/HostawayService');
const { OpenAIService } = require('../infraestructure/external/openai/OpenAIService');
const { WhatsAppService } = require('../infraestructure/external/whatsapp/WhatsAppService');

// Repositories
const { MongoFAQRepository, MongoSupportTicketRepository } = require('../infraestructure/database/mongodb/AdditionalRepositories');

// Use Cases
const { ProcessWebhookUseCase } = require('../application/usecases/ProcessWebhookUseCase');
const { GenerateResponseUseCase } = require('../application/usecases/GenerateResponseUseCase');
const { SendNotificationUseCase } = require('../application/usecases/SendNotificationUseCase');

// Controllers and Middleware
const { WebhookController, HealthController, AdminController,
         AuthMiddleware, ValidationMiddleware, ErrorMiddleware } = require('../presentation/controllers/WebhookController');

class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.logger = new SecureLogger();
    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing dependency container...');

      // Validate environment variables first
      Validator.validateEnvironmentVariables();

      // 1. Infrastructure Layer
      await this.initializeInfrastructure();

      // 2. Repositories
      this.initializeRepositories();

      // 3. External Services
      await this.initializeExternalServices();

      // 4. Use Cases
      this.initializeUseCases();

      // 5. Controllers and Middleware
      this.initializePresentation();

      this.initialized = true;
      this.logger.info('Dependency container initialized successfully');

      return true;

    } catch (error) {
      this.logger.error('Failed to initialize dependency container', {
        error: error.message
      });
      throw error;
    }
  }

  async initializeInfrastructure() {
    this.logger.debug('Initializing infrastructure...');

    // Database Connection
    const databaseConnection = new DatabaseConnection();
    await databaseConnection.connect(process.env.MONGODB_URI);
    this.register('databaseConnection', databaseConnection);

    // Security Components
    this.register('rateLimiter', new RateLimiter());
    this.register('tokenManager', new TokenManager());
    this.register('validator', new Validator());

    // Start cleanup intervals
    const rateLimiter = this.get('rateLimiter');
    const tokenManager = this.get('tokenManager');

    setInterval(() => {
      rateLimiter.cleanup();
      tokenManager.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    this.logger.debug('Infrastructure initialized');
  }

  initializeRepositories() {
    this.logger.debug('Initializing repositories...');

    // MongoDB Repositories
    this.register('conversationRepository', new MongoConversationRepository());
    this.register('listingRepository', new MongoListingRepository());
    this.register('faqRepository', new MongoFAQRepository());
    this.register('supportTicketRepository', new MongoSupportTicketRepository());

    this.logger.debug('Repositories initialized');
  }

  async initializeExternalServices() {
    this.logger.debug('Initializing external services...');

    // Hostaway Service
    const hostawayService = new HostawayService();
    await hostawayService.initialize();
    this.register('hostawayService', hostawayService);

    // AI Service
    const aiService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.register('aiService', aiService);

    // WhatsApp Service (optional)
    if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
      const whatsappService = new WhatsAppService({
        apiUrl: process.env.WHATSAPP_API_URL,
        apiToken: process.env.WHATSAPP_API_TOKEN,
        phoneNumber: process.env.SUPPORT_WHATSAPP_NUMBER
      });
      this.register('whatsappService', whatsappService);
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
    this.register('generateResponseUseCase', generateResponseUseCase);

    // Send Notification Use Case
    const sendNotificationUseCase = new SendNotificationUseCase({
      supportTicketRepository: this.get('supportTicketRepository'),
      whatsappService: this.get('whatsappService'),
      emailService: this.get('emailService') // Optional
    });
    this.register('sendNotificationUseCase', sendNotificationUseCase);

    // Process Webhook Use Case
    const processWebhookUseCase = new ProcessWebhookUseCase({
      conversationRepository: this.get('conversationRepository'),
      reservationRepository: null, // We don't store reservations locally
      listingRepository: this.get('listingRepository'),
      generateResponseUseCase,
      sendNotificationUseCase,
      hostawayService: this.get('hostawayService')
    });
    this.register('processWebhookUseCase', processWebhookUseCase);

    this.logger.debug('Use cases initialized');
  }

  initializePresentation() {
    this.logger.debug('Initializing presentation layer...');

    // Middleware
    this.register('authMiddleware', new AuthMiddleware());
    this.register('validationMiddleware', new ValidationMiddleware());
    this.register('errorMiddleware', new ErrorMiddleware());

    // Controllers
    const webhookController = new WebhookController({
      processWebhookUseCase: this.get('processWebhookUseCase'),
      rateLimiter: this.get('rateLimiter')
    });
    this.register('webhookController', webhookController);

    const healthController = new HealthController({
      databaseConnection: this.get('databaseConnection'),
      hostawayService: this.get('hostawayService'),
      aiService: this.get('aiService'),
      conversationRepository: this.get('conversationRepository'),
      listingRepository: this.get('listingRepository')
    });
    this.register('healthController', healthController);

    const adminController = new AdminController({
      conversationRepository: this.get('conversationRepository'),
      supportTicketRepository: this.get('supportTicketRepository'),
      listingRepository: this.get('listingRepository')
    });
    this.register('adminController', adminController);

    this.logger.debug('Presentation layer initialized');
  }

  register(name, instance) {
    if (this.dependencies.has(name)) {
      throw new Error(`Dependency ${name} is already registered`);
    }
    
    this.dependencies.set(name, instance);
    this.logger.debug(`Registered dependency: ${name}`);
  }

  get(name) {
    if (!this.dependencies.has(name)) {
      throw new Error(`Dependency ${name} is not registered`);
    }
    
    return this.dependencies.get(name);
  }

  has(name) {
    return this.dependencies.has(name);
  }

  // Health check for all dependencies
  async healthCheck() {
    const results = {};

    for (const [name, instance] of this.dependencies.entries()) {
      try {
        if (typeof instance.healthCheck === 'function') {
          results[name] = await instance.healthCheck();
        } else {
          results[name] = { healthy: true, status: 'available' };
        }
      } catch (error) {
        results[name] = { 
          healthy: false,
          status: 'error', 
          error: error.message 
        };
      }
    }

    return results;
  }

  async shutdown() {
    this.logger.info('Shutting down dependency container...');

    for (const [name, instance] of this.dependencies.entries()) {
      try {
        if (typeof instance.shutdown === 'function') {
          await instance.shutdown();
          this.logger.debug(`Shutdown completed for: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Error shutting down ${name}`, {
          error: error.message
        });
      }
    }

    this.dependencies.clear();
    this.initialized = false;
    this.logger.info('Dependency container shutdown completed');
  }
}

module.exports = { DependencyContainer };