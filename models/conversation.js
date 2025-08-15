// models/conversation.js
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  guestId: {
    type: String,
    required: true,
    index: true
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
        required: true
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      },
      metadata: {
        source: {
          type: String,
          enum: ["listing", "faq", "fallback", "human"]
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
  },
  summary: {
    totalMessages: { type: Number, default: 0 },
    needsHumanSupport: { type: Boolean, default: false },
    commonTopics: { type: [String], default: [] },
    satisfactionScore: { type: Number, default: null }
  }
});

// Índices optimizados
ConversationSchema.index({ guestId: 1, lastActivity: -1 });

// Middleware para actualizar estadísticas automáticamente
ConversationSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  this.summary.totalMessages = this.messages ? this.messages.length : 0;
  next();
});

// Especificar nombre exacto de colección
module.exports = mongoose.model("Conversation", ConversationSchema, "Conversation");