// src/infraestructure/database/mongodb/Connection.js
const mongoose = require('mongoose');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');

class DatabaseConnection {
  constructor() {
    this.logger = new SecureLogger();
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async connect(uri) {
    try {
      this.logger.info('Attempting to connect to MongoDB', { uri: uri ? 'configured' : 'not configured' });

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        autoIndex: process.env.NODE_ENV !== 'production', // Disable in production
        retryWrites: true,
        retryReads: true
      };

      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      this.logger.info('Successfully connected to MongoDB', {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        readyState: mongoose.connection.readyState
      });

      // Setup connection event handlers
      this.setupEventHandlers();
      
      return true;

    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      
      this.logger.error('Failed to connect to MongoDB', {
        error: error.message,
        retries: this.connectionRetries,
        maxRetries: this.maxRetries
      });

      if (this.connectionRetries < this.maxRetries) {
        this.logger.info(`Retrying connection in ${this.retryDelay}ms...`);
        setTimeout(() => this.connect(uri), this.retryDelay);
      } else {
        throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts`);
      }
      
      return false;
    }
  }

  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      this.logger.info('MongoDB connection established');
    });

    mongoose.connection.on('error', (error) => {
      this.isConnected = false;
      this.logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      this.logger.warn('MongoDB connection lost');
      
      // Attempt to reconnect
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect(process.env.MONGODB_URI);
        }
      }, this.retryDelay);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      this.logger.info('MongoDB connection closed');
    } catch (error) {
      this.logger.error('Error closing MongoDB connection', { error: error.message });
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { healthy: false, message: 'Not connected' };
      }

      // Test a simple operation
      await mongoose.connection.db.admin().ping();
      
      return {
        healthy: true,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  async shutdown() {
    await this.disconnect();
  }
}

module.exports = { DatabaseConnection };