// src/infraestructure/secutiry/TokenManager.js
const crypto = require('crypto');

class TokenManager {
  constructor() {
    this.tokens = new Map(); // In production, use secure storage
    this.defaultExpiryMs = 24 * 60 * 60 * 1000; // 24 hours
  }

  store(key, token, expiryMs = this.defaultExpiryMs) {
    const expiresAt = Date.now() + expiryMs;
    
    this.tokens.set(key, {
      token: this.encrypt(token),
      expiresAt
    });

    // Auto-cleanup expired tokens
    setTimeout(() => {
      this.tokens.delete(key);
    }, expiryMs);

    return { expiresAt };
  }

  retrieve(key) {
    const entry = this.tokens.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(key);
      return null;
    }

    return this.decrypt(entry.token);
  }

  isValid(key) {
    const entry = this.tokens.get(key);
    return entry && Date.now() <= entry.expiresAt;
  }

  revoke(key) {
    return this.tokens.delete(key);
  }

  cleanup() {
    const now = Date.now();
    
    for (const [key, entry] of this.tokens.entries()) {
      if (now > entry.expiresAt) {
        this.tokens.delete(key);
      }
    }
  }

  encrypt(text) {
    if (!process.env.ENCRYPTION_KEY) {
      // In development, just encode
      return Buffer.from(text).toString('base64');
    }

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipherGCM(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText) {
    if (!process.env.ENCRYPTION_KEY) {
      // In development, just decode
      return Buffer.from(encryptedText, 'base64').toString();
    }

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipherGCM(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

class RateLimiter {
  constructor() {
    this.requests = new Map(); // In production, use Redis
    this.windowMs = 15 * 60 * 1000; // 15 minutes
    this.maxRequests = 100; // Max requests per window
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
}

module.exports = { TokenManager, RateLimiter };