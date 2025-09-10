// src/shared/logger/SecureLogger.js
const { Validator } = require('../../infrastructure/security/Validator');
const mongoose = require('mongoose');

class SecureLogger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.environment = process.env.NODE_ENV || 'development';
    this.pendingLogs = [];
    this.isShuttingDown = false;
    this.flushInterval = null;
    this.isMongoConnected = false;
    this.originalConsole = {};
    this.initializeLogModel();
    this.interceptConsole();
    this.startFlushInterval();
  }

  initializeLogModel() {
    // Define el esquema localmente para evitar problemas de timing con la conexión
    const logSchema = new mongoose.Schema({
      level: {
        type: String,
        enum: ['info', 'error', 'warn', 'debug'],
        required: true,
        index: true
      },
      message: {
        type: String,
        required: true
      },
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
      },
      timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
      },
      service: {
        type: String,
        required: false,
        index: true
      },
      environment: {
        type: String,
        enum: ['development', 'production', 'testing'],
        required: true,
        index: true
      },
      source: {
        type: String,
        enum: ['logger', 'console'],
        default: 'logger',
        index: true
      }
    }, { 
      timestamps: true,
      collection: 'SystemLogs'
    });

    // Crea el modelo solo si no existe
    this.LogModel = mongoose.models.SystemLog || mongoose.model('SystemLog', logSchema);
    
    // Monitorea el estado de la conexión
    mongoose.connection.on('connected', () => {
      this.isMongoConnected = true;
      this.flushPendingLogs(); // Intenta guardar logs pendientes cuando se conecte
    });
    
    mongoose.connection.on('disconnected', () => {
      this.isMongoConnected = false;
    });
  }

  interceptConsole() {
    // Guarda las funciones originales
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    // Intercepta console.log
    console.log = (...args) => {
      this.originalConsole.log(...args);
      this.saveConsoleLog('info', args);
    };

    // Intercepta console.error
    console.error = (...args) => {
      this.originalConsole.error(...args);
      this.saveConsoleLog('error', args);
    };

    // Intercepta console.warn
    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      this.saveConsoleLog('warn', args);
    };

    // Intercepta console.info
    console.info = (...args) => {
      this.originalConsole.info(...args);
      this.saveConsoleLog('info', args);
    };

    // Intercepta console.debug
    console.debug = (...args) => {
      this.originalConsole.debug(...args);
      if (this.isDevelopment) {
        this.saveConsoleLog('debug', args);
      }
    };
  }

  saveConsoleLog(level, args) {
    try {
      // Convierte los argumentos en un mensaje legible
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      }).join(' ');

      // Extrae metadatos de objetos si los hay
      const metadata = {};
      args.forEach((arg, index) => {
        if (typeof arg === 'object' && arg !== null) {
          metadata[`arg_${index}`] = arg;
        }
      });

      // Guarda en la cola de logs
      this.pendingLogs.push({
        level,
        message,
        metadata: new Map(Object.entries(metadata)),
        timestamp: new Date(),
        environment: this.environment,
        service: 'SmithersV2',
        source: 'console'
      });

      // Si hay demasiados logs pendientes, intenta guardarlos inmediatamente
      if (this.pendingLogs.length >= 100) {
        setImmediate(() => this.flushPendingLogs());
      }
    } catch (error) {
      // Evita loops infinitos si hay error al procesar el log
      this.originalConsole.error('Error saving console log:', error);
    }
  }

  startFlushInterval() {
    // Flush logs every 5 seconds
    this.flushInterval = setInterval(async () => {
      await this.flushPendingLogs();
    }, 5000);
  }

  async flushPendingLogs() {
    if (this.pendingLogs.length === 0 || this.isShuttingDown) return;
    if (!this.isMongoConnected || !this.LogModel) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      await this.LogModel.insertMany(logsToFlush.map(log => ({
        ...log,
        environment: this.environment,
        service: 'SmithersV2'
      })), { ordered: false });
    } catch (error) {
      if (!this.isShuttingDown) {
        this.pendingLogs.unshift(...logsToFlush);
      }
    }
  }

  queueLog(level, message, data = {}) {
    const sanitizedData = Validator.sanitizeLogData(data);
    const timestamp = new Date();
    
    // Usar la función original de console para evitar loops infinitos
    this.originalConsole[level === 'debug' ? 'log' : level](
      `[${level.toUpperCase()}] ${timestamp.toISOString()} - ${message}`, 
      sanitizedData
    );

    // Queue for MongoDB
    this.pendingLogs.push({
      level,
      message,
      metadata: new Map(Object.entries(sanitizedData)),
      timestamp,
      environment: this.environment,
      service: 'SmithersV2',
      source: 'logger'
    });

    // Si hay demasiados logs pendientes, intenta guardarlos inmediatamente
    if (this.pendingLogs.length >= 100) {
      setImmediate(() => this.flushPendingLogs());
    }
  }

  info(message, data = {}) {
    this.queueLog('info', message, data);
  }

  error(message, data = {}) {
    this.queueLog('error', message, data);
  }

  warn(message, data = {}) {
    this.queueLog('warn', message, data);
  }

  debug(message, data = {}) {
    if (this.isDevelopment) {
      this.queueLog('debug', message, data);
    }
  }

  restoreConsole() {
    // Restaura las funciones originales de console
    if (this.originalConsole.log) {
      console.log = this.originalConsole.log;
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
      console.info = this.originalConsole.info;
      console.debug = this.originalConsole.debug;
    }
  }

  async shutdown() {
    this.isShuttingDown = true;
    clearInterval(this.flushInterval);
    
    // Restaura las funciones originales de console
    this.restoreConsole();
    
    // Intento final de guardar logs pendientes
    if (this.pendingLogs.length > 0 && this.isMongoConnected) {
      try {
        await this.flushPendingLogs();
      } catch (error) {
        this.originalConsole.error('Error al guardar los últimos logs:', error);
      }
    }
  }
}

module.exports = { SecureLogger };