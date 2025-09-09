// src/shared/logger/SecureLogger.js
const { Validator } = require('../../infrastructure/security/Validator');

class SecureLogger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  info(message, data = {}) {
    const sanitizedData = Validator.sanitizeLogData(data);
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, sanitizedData);
  }

  error(message, data = {}) {
    const sanitizedData = Validator.sanitizeLogData(data);
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, sanitizedData);
  }

  warn(message, data = {}) {
    const sanitizedData = Validator.sanitizeLogData(data);
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, sanitizedData);
  }

  debug(message, data = {}) {
    if (this.isDevelopment) {
      const sanitizedData = Validator.sanitizeLogData(data);
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, sanitizedData);
    }
  }

  audit(message, data = {}) {
    const sanitizedData = Validator.sanitizeLogData(data);
    console.log(`[AUDIT] ${new Date().toISOString()} - ${message}`, sanitizedData);
  }
}

module.exports = { SecureLogger };