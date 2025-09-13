const mongoose = require('mongoose');

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
    ip: String,
    userId: String,
    path: String,
    method: String,
    statusCode: Number,
    processingTime: Number,
    environment: {
        type: String,
        enum: ['development', 'production', 'testing'],
        required: true,
        index: true
    }
}, { 
    timestamps: true,
    collection: 'SystemLogs' // Nombre exacto de la colección
});

// Índices compuestos para consultas comunes
logSchema.index({ level: 1, timestamp: -1 });
logSchema.index({ service: 1, level: 1, timestamp: -1 });

const LogModel = mongoose.model('SystemLog', logSchema, 'SystemLogs');

module.exports = { LogModel };
