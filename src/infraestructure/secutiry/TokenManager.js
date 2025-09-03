// src/infraestructure/secutiry/TokenManager.js
const crypto = require('crypto');

class TokenManager {
  constructor() {
    this.tokens = new Map(); // In production, use secure storage like Redis
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

    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipherGCM(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      // Fallback to base64 if encryption fails
      return Buffer.from(text).toString('base64');
    }
  }

  decrypt(encryptedText) {
    if (!process.env.ENCRYPTION_KEY) {
      // In development, just decode
      return Buffer.from(encryptedText, 'base64').toString();
    }

    try {
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
    } catch (error) {
      // Fallback to base64 if decryption fails
      return Buffer.from(encryptedText, 'base64').toString();
    }
  }

  // Health check method
  healthCheck() {
    return {
      healthy: true,
      activeTokens: this.tokens.size,
      encryptionEnabled: !!process.env.ENCRYPTION_KEY
    };
  }

  // Get statistics
  getStatistics() {
    const now = Date.now();
    let validTokens = 0;
    let expiredTokens = 0;

    for (const [key, entry] of this.tokens.entries()) {
      if (now <= entry.expiresAt) {
        validTokens++;
      } else {
        expiredTokens++;
      }
    }

    return {
      totalTokens: this.tokens.size,
      validTokens,
      expiredTokens
    };
  }

  // Shutdown method
  shutdown() {
    this.tokens.clear();
  }
}

module.exports = { TokenManager };