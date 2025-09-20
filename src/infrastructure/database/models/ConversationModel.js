// src/infraestructure/database/models/ConversationModel.js
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  guestId: {
    type: String,
    required: true,
    maxLength: 255
    // REMOVED: index: true (se define abajo para evitar duplicados)
  },
  messages: [
    {
      role: { 
        type: String, 
        enum: ["guest", "agent"],
        required: true 
      },
      content: {
        type: String,
        required: true,
        maxLength: 5000
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      },
      metadata: {
        source: {
          type: String,
          enum: ["listing", "faq", "fallback", "human", "technical-fallback", "ai-fallback", "listing-direct"]
        },
        detectedField: String,
        listingMapId: Number,
        confidence: Number,
        processingTime: Number,
        reservationId: String,
        conversationId: String,
        messageId: String,
        hostaway: Boolean,
        context: mongoose.Schema.Types.Mixed
      }
    }
  ],
  lastActivity: {
    type: Date,
    default: Date.now
    // REMOVED: index: true (se define abajo para evitar duplicados)
  },
  summary: {
    totalMessages: { type: Number, default: 0 },
    needsHumanSupport: { type: Boolean, default: false },
    commonTopics: { type: [String], default: [] },
    satisfactionScore: { type: Number, default: null }
  }
}, {
  timestamps: true
});

// Índices definidos explícitamente (sin duplicados)
ConversationSchema.index({ guestId: 1 });
ConversationSchema.index({ guestId: 1, lastActivity: -1 });
ConversationSchema.index({ lastActivity: -1 });
ConversationSchema.index({ 'summary.needsHumanSupport': 1 });

// TTL index for automatic cleanup (30 days)
ConversationSchema.index({ 
  lastActivity: 1 
}, { 
  expireAfterSeconds: 30 * 24 * 60 * 60,
  partialFilterExpression: { 
    'summary.needsHumanSupport': false 
  }
});

module.exports = mongoose.model("Conversation", ConversationSchema, "Conversation");