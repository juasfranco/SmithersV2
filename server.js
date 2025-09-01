// src/server.js - VERSIÓN REFACTORIZADA CON CLEAN ARCHITECTURE
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const { DependencyContainer } = require('./src/config/DependencyContainer');
const { SecurityHeaders } = require('./infrastructure/security/TokenManager');
const { SecureLogger } = require('./src/shared/logger/SecureLogger');
const routes = require('./src/presentation/routes');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.logger = new SecureLogger();
    this.container = null;
    this.server = null;
  }

  async initialize() {
    try {
      this.logger.info('🚀 Initializing Smithers v2 with Clean Architecture...');

      // 1. Initialize dependency container
      this.container = new DependencyContainer();
      await this.container.initialize();

      // 2. Configure Express app
      this.configureMiddleware();
      this.configureRoutes();
      this.configureErrorHandling();

      // 3. Setup graceful shutdown
      this.setupGracefulShutdown();

      this.logger.info('✅ Server initialization completed');
      return true;

    } catch (error) {
      this.logger.error('❌ Server initialization failed', {
        error: error.message,
        stack: error.stack
      });
      
      await this.shutdown();
      throw error;
    }
  }

  configureMiddleware() {
    this.logger.debug('Configuring middleware...');

    // Security headers
    this.app.use(SecurityHeaders.getMiddleware());
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"]
        }
      }
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    };
    this.app.use(cors(corsOptions));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf; // For webhook signature verification
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting (global)
    const rateLimiter = this.container.get('rateLimiter');
    this.app.use(rateLimiter.getMiddleware());

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      // Log request
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
      });

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });
      });

      next();
    });

    // Inject container into requests
    this.app.use((req, res, next) => {
      req.container = this.container;
      next();
    });

    this.logger.debug('Middleware configuration completed');
  }

  configureRoutes() {
    this.logger.debug('Configuring routes...');

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      const healthController = this.container.get('healthController');
      healthController.getHealthStatus(req, res);
    });

    // API routes
    this.app.use('/api', routes(this.container));

    // Legacy webhook endpoint (backward compatibility)
    this.app.post('/webhooks/hostaway', (req, res) => {
      const webhookController = this.container.get('webhookController');
      webhookController.handleHostawayWebhook(req, res);
    });

    this.logger.debug('Routes configuration completed');
  }

  configureErrorHandling() {
    this.logger.debug('Configuring error handling...');

    // 404 handler
    const errorMiddleware = this.container.get('errorMiddleware');
    this.app.use(errorMiddleware.handle404());

    // Global error handler
    this.app.use(errorMiddleware.handleErrors());

    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
    });

    // Uncaught exception
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown on uncaught exception
      this.shutdown().then(() => process.exit(1));
    });

    this.logger.debug('Error handling configuration completed');
  }

  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    // Handle PM2 graceful shutdown
    process.on('message', async (msg) => {
      if (msg === 'shutdown') {
        this.logger.info('Received PM2 shutdown message');
        await this.shutdown();
        process.exit(0);
      }
    });
  }

  async start() {
    try {
      // Initialize if not already done
      if (!this.container) {
        await this.initialize();
      }

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        this.logger.info('🎉 Smithers v2 server started successfully', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid,
          endpoints: {
            health: `http://localhost:${this.port}/health`,
            webhook: `http://localhost:${this.port}/webhooks/hostaway`,
            admin: `http://localhost:${this.port}/api/admin/stats`,
            debug: `http://localhost:${this.port}/api/debug/conversations`
          }
        });

        // Start background tasks
        this.startBackgroundTasks();
      });

      // Handle server errors
      this.server.on('error', (error) => {
        this.logger.error('Server error', { error: error.message });
        throw error;
      });

      return this.server;

    } catch (error) {
      this.logger.error('Failed to start server', { error: error.message });
      throw error;
    }
  }

  startBackgroundTasks() {
    this.logger.info('Starting background tasks...');

    // Auto-learning from conversation patterns
    setInterval(async () => {
      try {
        this.logger.debug('Running automated learning...');
        // This could integrate with your ML/learning use cases
        // const learningUseCase = this.container.get('learningUseCase');
        // await learningUseCase.execute();
      } catch (error) {
        this.logger.error('Background learning task failed', {
          error: error.message
        });
      }
    }, 60 * 60 * 1000); // Every hour

    // Health monitoring
    setInterval(async () => {
      try {
        const health = await this.container.healthCheck();
        const unhealthyServices = Object.entries(health)
          .filter(([, status]) => !status.healthy)
          .map(([name]) => name);

        if (unhealthyServices.length > 0) {
          this.logger.warn('Unhealthy services detected', {
            services: unhealthyServices
          });
        }
      } catch (error) {
        this.logger.error('Health check failed', {
          error: error.message
        });
      }
    }, 30 * 1000); // Every 30 seconds

    this.logger.info('Background tasks started');
  }

  async shutdown() {
    this.logger.info('Starting server shutdown...');

    try {
      // Stop accepting new requests
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        this.logger.info('HTTP server closed');
      }

      // Shutdown dependency container
      if (this.container) {
        await this.container.shutdown();
        this.logger.info('Dependencies shut down');
      }

      this.logger.info('✅ Server shutdown completed gracefully');

    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: error.message
      });
    }
  }
}
