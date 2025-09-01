// src/shared/logger/SecureLogger.js
class SecureLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  log(level, message, data = {}) {
    if (this.levels[level] > this.levels[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const sanitizedData = Validator.sanitizeLogData(data);
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data: sanitizedData,
      pid: process.pid
    };

    // In production, send to proper logging service
    console.log(JSON.stringify(logEntry));
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  // Special method for audit logs
  audit(action, data = {}) {
    this.log('info', `AUDIT: ${action}`, {
      ...data,
      auditLog: true,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  Validator,
  RateLimiter,
  TokenManager,
  SecurityHeaders,
  SecureLogger
};