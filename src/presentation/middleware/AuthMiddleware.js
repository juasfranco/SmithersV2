// src/presentation/middleware/AuthMiddleware.js - Con import correcto
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class AuthMiddleware {
  constructor() {
    this.logger = new SecureLogger();
  }

  // Basic API key authentication for admin endpoints
  requireApiKey() {
    return (req, res, next) => {
      const apiKey = req.header('X-API-Key') || req.query.apiKey;
      const validApiKey = process.env.ADMIN_API_KEY;

      if (!validApiKey) {
        this.logger.warn('Admin API key not configured');
        return res.status(500).json({ error: 'Authentication not configured' });
      }

      if (!apiKey || apiKey !== validApiKey) {
        this.logger.warn('Invalid API key attempt', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        
        return res.status(401).json({ error: 'Invalid API key' });
      }

      this.logger.audit('Admin access granted', {
        ip: req.ip,
        path: req.path
      });

      next();
    };
  }

  // IP whitelist for sensitive endpoints
  requireWhitelistedIP() {
    return (req, res, next) => {
      const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];
      
      if (allowedIPs.length === 0) {
        return next(); // Skip if no whitelist configured
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!allowedIPs.includes(clientIP)) {
        this.logger.warn('IP not whitelisted', {
          ip: clientIP,
          allowedIPs,
          path: req.path
        });
        
        return res.status(403).json({ error: 'IP not authorized' });
      }

      next();
    };
  }
}