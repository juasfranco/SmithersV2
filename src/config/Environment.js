// src/config/Environment.js
class Environment {
  static validate() {
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

    return true;
  }

  static get(key, defaultValue = null) {
    return process.env[key] || defaultValue;
  }

  static isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  static isProduction() {
    return process.env.NODE_ENV === 'production';
  }
}

module.exports = { Environment };