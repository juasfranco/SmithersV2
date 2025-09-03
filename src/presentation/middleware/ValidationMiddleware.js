// src/presentation/middleware/ValidationMiddleware.js
const { Validator } = require('../../infraestructure/secutiry/Validator'); // Corregido: infraestructure (con "e")
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class ValidationMiddleware {
  constructor() {
    this.logger = new SecureLogger();
  }

  validateWebhook() {
    return (req, res, next) => {
      // Validate content type
      if (!req.is('application/json')) {
        return res.status(400).json({
          error: 'Content-Type must be application/json'
        });
      }

      // Validate body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: 'Request body is required'
        });
      }

      // Sanitize input
      req.body = this.sanitizeRequestBody(req.body);
      
      next();
    };
  }

  sanitizeRequestBody(body) {
    if (typeof body !== 'object' || body === null) {
      return body;
    }

    const sanitized = {};
    
    Object.keys(body).forEach(key => {
      if (typeof body[key] === 'string') {
        sanitized[key] = Validator.sanitizeInput(body[key]);
      } else if (typeof body[key] === 'object') {
        sanitized[key] = this.sanitizeRequestBody(body[key]);
      } else {
        sanitized[key] = body[key];
      }
    });

    return sanitized;
  }
}

module.exports = { ValidationMiddleware };