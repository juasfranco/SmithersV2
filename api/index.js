// api/index.js - Vercel Serverless Function Entry Point
const { DependencyContainer } = require('../src/config/DependencyContainer');
const { SecurityHeaders } = require('../src/infrastructure/security/SecurityHeaders');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');
const routes = require('../src/presentation/routes');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Global container to reuse across function invocations
let globalContainer = null;
let app = null;

async function createApp() {
  if (app) {
    return app;
  }

  const logger = new SecureLogger();
  
  try {
    logger.info('🚀 Initializing Smithers v2 for Vercel...');

    // Initialize dependency container (reuse if exists)
    if (!globalContainer) {
      globalContainer = new DependencyContainer();
      await globalContainer.initialize();
    }

    // Create Express app
    app = express();

    // Configure middleware
    configureMiddleware(app, globalContainer, logger);
    
    // Configure routes
    configureRoutes(app, globalContainer);
    
    // Configure error handling
    configureErrorHandling(app, globalContainer);

    logger.info('✅ Vercel function initialization completed');
    return app;

  } catch (error) {
    logger.error('❌ Vercel function initialization failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

function configureMiddleware(app, container, logger) {
  // Security headers
  app.use((req, res, next) => {
    const secureHeaders = SecurityHeaders.getSecureHeaders();
    Object.entries(secureHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  });
  app.use(helmet());

  // CORS configuration
  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  };
  app.use(cors(corsOptions));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting (simpler for serverless)
  const rateLimiter = container.get('rateLimiter');
  app.use(rateLimiter.getMiddleware());

  // Request logging
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.get('User-Agent')
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  });

  // Inject container into requests
  app.use((req, res, next) => {
    req.container = container;
    next();
  });
}

function configureRoutes(app, container) {
  // Health check endpoint
  app.get('/health', (req, res) => {
    const healthController = container.get('healthController');
    healthController.getHealthStatus(req, res);
  });

  // API routes
  app.use('/api', routes(container));

  // Legacy webhook endpoint (backward compatibility)
  app.post('/webhooks/hostaway', (req, res) => {
    const webhookController = container.get('webhookController');
    webhookController.handleHostawayWebhook(req, res);
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Smithers v2 - Virtual Assistant API',
      version: '2.0.0',
      environment: 'serverless',
      endpoints: {
        health: '/health',
        webhook: '/webhooks/hostaway',
        admin: '/api/admin/stats',
        debug: '/api/debug/conversations'
      }
    });
  });
}

function configureErrorHandling(app, container) {
  // 404 handler
  const errorMiddleware = container.get('errorMiddleware');
  app.use(errorMiddleware.handle404());

  // Global error handler
  app.use(errorMiddleware.handleErrors());
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    const expressApp = await createApp();
    
    // Handle the request with Express
    return expressApp(req, res);
    
  } catch (error) {
    console.error('Vercel function error:', error);
    
    // Fallback error response
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'The serverless function encountered an error',
      timestamp: new Date().toISOString()
    });
  }
};

// Export for compatibility
module.exports.default = module.exports;