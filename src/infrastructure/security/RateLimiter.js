// src/infraestructure/secutiry/RateLimiter.js
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class RateLimiter {
  constructor() {
    this.requests = new Map(); // In production, use Redis
    this.windowMs = 15 * 60 * 1000; // 15 minutes
    this.maxRequests = 100; // Max requests per window
    this.logger = new SecureLogger();
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart);
    this.requests.set(identifier, validRequests);

    // Check if under limit
    if (validRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + this.windowMs
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
      resetTime: windowStart + this.windowMs
    };
  }

  getMiddleware() {
    return (req, res, next) => {
      const identifier = req.ip || req.connection.remoteAddress;
      const result = this.isAllowed(identifier);

      res.set({
        'X-RateLimit-Limit': this.maxRequests,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      next();
    };
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }

  // Health check method
  healthCheck() {
    return {
      healthy: true,
      activeConnections: this.requests.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }

  // Shutdown method
  shutdown() {
    this.requests.clear();
    this.logger.info('RateLimiter shutdown completed');
  }
}

module.exports = { RateLimiter };