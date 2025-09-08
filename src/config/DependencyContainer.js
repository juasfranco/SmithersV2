// src/config/DependencyContainer.js
const { SecureLogger } = require('../shared/logger/SecureLogger');
const { Validator } = require('../infraestructure/secutiry/Validator');

// Database
const { DatabaseConnection } = require('../infraestructure/database/mongodb/Connection');
const { MongoListingRepository } = require('../infraestructure/database/mongodb/ListingRepository');
const { MongoConversationRepository } = require('../infraestructure/database/mongodb/ConversationRepository');
const { MongoFAQRepository } = require('../infraestructure/database/mongodb/FAQRepository');
const { MongoSupportTicketRepository } = require('../infraestructure/database/mongodb/AdditionalRepositories');

// External Services
const { HostawayService } = require('../infraestructure/external/hostaway/HostawayService');
const { OpenAIService } = require('../infraestructure/external/openai/OpenAIService');
const { WhatsAppService } = require('../infraestructure/external/whatsapp/WhatsAppService');

// Security
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

  get(name) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      this.logger.error(`Dependency ${name} not found in container`, {
        availableDependencies: Array.from(this.dependencies.keys())
      });
      throw new Error(`Dependency ${name} not found in container`);
    }
    return dependency;
  }

  validateDependencies() {
    const requiredDependencies = [
      'databaseConnection',
      'rateLimiter',
      'tokenManager',
      'validator',
      'listingRepository',
      'conversationRepository',
      'faqRepository',
      'supportTicketRepository',
      'hostawayService',
      'aiService',
      'generateResponseUseCase',
      'sendNotificationUseCase',
      'processWebhookUseCase',
      'healthController',
      'webhookController',
      'adminController'
    ];

    const missing = requiredDependencies.filter(dep => !this.dependencies.has(dep));
    if (missing.length > 0) {
      this.logger.error('Missing required dependencies', { missing });
      throw new Error(`Missing required dependencies: ${missing.join(', ')}`);
    }
  }

  async initialize() {
    try {
      this.logger.info('Initializing dependency container...');

      // 1. Initialize infrastructure
      await this.initializeInfrastructure();

      // 2. Initialize repositories
      this.initializeRepositories();

      // 3. Initialize services
      await this.initializeServices();

      // 4. Initialize use cases
      this.initializeUseCases();

      // 5. Initialize controllers
      this.initializeControllers();

      // 6. Initialize middleware
      this.initializeMiddleware();

      // 7. Validate all dependencies
      this.validateDependencies();

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

    // Initialize validator
    const validator = new Validator();
    this.dependencies.set('validator', validator);

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
    try {
      this.logger.debug('Initializing use cases...');

      // First initialize all repositories and services needed
      const listingRepository = this.get('listingRepository');
      const faqRepository = this.get('faqRepository');
      const conversationRepository = this.get('conversationRepository');
      const supportTicketRepository = this.get('supportTicketRepository');
      const aiService = this.get('aiService');
      const hostawayService = this.get('hostawayService');
      const whatsappService = this.dependencies.get('whatsappService'); // Optional

    // Generate Response Use Case
    const generateResponseUseCase = new GenerateResponseUseCase({
      listingRepository,
      faqRepository,
      conversationRepository,
      aiService,
      hostawayService
    });
    this.dependencies.set('generateResponseUseCase', generateResponseUseCase);

    // Send Notification Use Case
    const sendNotificationUseCase = new SendNotificationUseCase({
      supportTicketRepository,
      whatsappService,
      emailService: null // TODO: Implement email service
    });
    this.dependencies.set('sendNotificationUseCase', sendNotificationUseCase);

    // Process Webhook Use Case
    try {
      this.logger.debug('Initializing ProcessWebhookUseCase...');
      const processWebhookUseCase = new ProcessWebhookUseCase({
        conversationRepository,
        reservationRepository: null, // TODO: Implement if needed
        listingRepository,
        generateResponseUseCase,
        sendNotificationUseCase,
        hostawayService
      });
      this.dependencies.set('processWebhookUseCase', processWebhookUseCase);
      this.logger.debug('ProcessWebhookUseCase initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ProcessWebhookUseCase', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }

    this.logger.debug('Use cases initialized');
    } catch (error) {
      this.logger.error('Error initializing use cases', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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
      rateLimiter: this.get('rateLimiter'),
      validator: this.get('validator')
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

  async shutdown() {
    this.logger.info('Shutting down dependency container...');

    try {
      // Close database connection
      const databaseConnection = this.dependencies.get('databaseConnection');
      if (databaseConnection) {
        await databaseConnection.close();
      }

      // Clean up any other resources that need it
      const hostawayService = this.dependencies.get('hostawayService');
      if (hostawayService) {
        await hostawayService.cleanup();
      }

      this.dependencies.clear();
      this.logger.info('Dependency container shut down successfully');

    } catch (error) {
      this.logger.error('Error during container shutdown', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    try {
      // Check database
      const db = this.get('databaseConnection');
      health.services.database = await db.healthCheck();

      // Check Hostaway
      const hostaway = this.get('hostawayService');
      health.services.hostaway = await hostaway.healthCheck();

      // Check OpenAI
      const ai = this.get('aiService');
      health.services.openai = await ai.healthCheck();

      return health;

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
      return health;
    }
  }
}

module.exports = DependencyContainer;