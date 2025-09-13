const mongoose = require('mongoose');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');
const { EventEmitter } = require('events');

/**
 * DatabaseConnection - Handles MongoDB connections with retry logic and event management
 */
class DatabaseConnection extends EventEmitter {
    constructor() {
        super();
        this.logger = new SecureLogger();
        this.mongoose = mongoose;
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000;
        this.isShuttingDown = false;

        // Increase event listener limits
        this.mongoose.connection.setMaxListeners(20);
        this.setMaxListeners(20);
    }

    async connect(uri) {
        if (this.isShuttingDown) {
            this.logger.warn('Connection attempt ignored - system is shutting down');
            return false;
        }

        try {
            this.logger.info('Attempting to connect to MongoDB', { 
                uri: uri ? 'configured' : 'not configured',
                attempt: this.connectionRetries + 1,
                maxRetries: this.maxRetries
            });

            const options = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                autoIndex: process.env.NODE_ENV !== 'production',
                retryWrites: true,
                retryReads: true,
                connectTimeoutMS: 30000,
                family: 4 // Force IPv4
            };

            await this.mongoose.connect(uri, options);
            
            this.isConnected = true;
            this.connectionRetries = 0;
            
            this.logger.info('Successfully connected to MongoDB', {
                database: this.mongoose.connection.name,
                host: this.mongoose.connection.host,
                readyState: this.mongoose.connection.readyState
            });

            this.setupEventHandlers();
            this.emit('connected');
            
            return true;

        } catch (error) {
            this.logger.error('Failed to connect to MongoDB', { 
                error: error.message,
                retries: this.connectionRetries 
            });
            
            if (!this.isShuttingDown && this.connectionRetries < this.maxRetries) {
                this.connectionRetries++;
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.connect(uri);
            }
            
            throw error;
        }
    }

    setupEventHandlers() {
        // Remove existing listeners to prevent duplicates
        this.mongoose.connection.removeAllListeners('disconnected');
        this.mongoose.connection.removeAllListeners('error');

        this.mongoose.connection.on('disconnected', () => {
            this.logger.warn('MongoDB disconnected');
            this.isConnected = false;
            
            if (!this.isShuttingDown) {
                this.tryReconnect();
            }
        });

        this.mongoose.connection.on('error', (error) => {
            this.logger.error('MongoDB connection error', { error: error.message });
        });

        process.removeAllListeners('SIGINT');
        process.on('SIGINT', async () => {
            await this.close();
            process.exit(0);
        });
    }

    async tryReconnect() {
        if (this.isShuttingDown || !process.env.MONGODB_URI) {
            return;
        }

        if (!this.isConnected && this.connectionRetries < this.maxRetries) {
            this.connectionRetries++;
            this.logger.info('Attempting to reconnect to MongoDB', {
                attempt: this.connectionRetries,
                maxRetries: this.maxRetries
            });

            try {
                await this.connect(process.env.MONGODB_URI);
            } catch (error) {
                this.logger.error('Reconnection attempt failed', { error: error.message });
                if (!this.isShuttingDown) {
                    setTimeout(() => this.tryReconnect(), this.retryDelay);
                }
            }
        }
    }

    async close() {
        this.isShuttingDown = true;

        try {
            if (this.mongoose.connection.readyState !== 0) {
                // Remove all listeners before closing
                this.mongoose.connection.removeAllListeners();
                this.removeAllListeners();

                await this.mongoose.connection.close(false); // force close
                this.isConnected = false;
                this.logger.info('MongoDB connection closed successfully');
            }
        } catch (error) {
            this.logger.error('Error closing MongoDB connection', { error: error.message });
            throw error;
        }
    }

    async healthCheck() {
        try {
            if (!this.isConnected) {
                return {
                    healthy: false,
                    error: 'Not connected to MongoDB'
                };
            }

            await this.mongoose.connection.db.admin().ping();
            
            return {
                healthy: true,
                status: 'Connected',
                readyState: this.mongoose.connection.readyState,
                host: this.mongoose.connection.host,
                name: this.mongoose.connection.name
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            readyState: this.mongoose.connection.readyState,
            host: this.mongoose.connection.host,
            name: this.mongoose.connection.name,
            retries: this.connectionRetries
        };
    }
}

module.exports = { DatabaseConnection };
