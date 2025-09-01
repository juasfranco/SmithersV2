// src/presentation/middleware/ErrorMiddleware.js

const { SecureLogger } = require('../../shared/logger/SecureLogger');

class ErrorMiddleware {
  constructor() {
    this.logger = new SecureLogger();
  }

  handleErrors() {
    return (error, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      };

      if (isDevelopment) {
        errorResponse.stack = error.stack;
      }

      res.status(500).json(errorResponse);
    };
  }

  handle404() {
    return (req, res) => {
      this.logger.warn('404 Not Found', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    };
  }
}

module.exports = {
  WebhookController,
  HealthController,
  AdminController,
  AuthMiddleware,
  ValidationMiddleware,
  ErrorMiddleware
};