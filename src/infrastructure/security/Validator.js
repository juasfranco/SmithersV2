// src/infrastructure/security/Validator.js
const crypto = require('crypto');

class Validator {
  static validateWebhookPayload(payload) {
    const errors = [];
    
    if (!payload) {
      errors.push('Payload is required');
      return { isValid: false, errors };
    }

    // Validate required fields based on webhook type
    if (payload.event === 'new message received' || payload.event === 'messageCreated') {
      if (!payload.reservationId && !payload.data?.reservationId) {
        errors.push('reservationId is required for message events');
      }
      
      if (!payload.message && !payload.data?.message) {
        errors.push('message is required for message events');
      }
    }

    // Validate data types
    if (payload.reservationId && !this.isValidId(payload.reservationId)) {
      errors.push('reservationId must be a valid identifier');
    }

    if (payload.listingMapId && !Number.isInteger(Number(payload.listingMapId))) {
      errors.push('listingMapId must be a valid number');
    }

    // Validate message content
    if (payload.message) {
      if (typeof payload.message !== 'string') {
        errors.push('message must be a string');
      } else if (payload.message.length > 5000) {
        errors.push('message exceeds maximum length');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .trim()
      .replace(/[<>\"\']/g, '') // Remove potential XSS characters
      .substring(0, 5000); // Limit length
  }

  static sanitizeLogData(data) {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization',
      'wifiPassword', 'doorCode', 'clientSecret', 'apiKey'
    ];

    const sanitized = JSON.parse(JSON.stringify(data));
    
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      Object.keys(obj).forEach(key => {
        const keyLower = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  static isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static isValidId(id) {
    if (!id) return false;
    
    const idStr = String(id);
    return idStr.length > 0 && idStr.length <= 100 && /^[a-zA-Z0-9\-_]+$/.test(idStr);
  }

  static validateEnvironmentVariables() {
    const required = [
      'MONGODB_URI',
      'OPENAI_API_KEY',
      'HOSTAWAY_ACCOUNT_ID',
      'HOSTAWAY_CLIENT_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate MongoDB URI format
    if (!process.env.MONGODB_URI.startsWith('mongodb')) {
      throw new Error('MONGODB_URI must be a valid MongoDB connection string');
    }

    return true;
  }
}

module.exports = { Validator };