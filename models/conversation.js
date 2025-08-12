// models/conversation.js - ACTUALIZADO para ser compatible con datos existentes
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
      // 🔹 NUEVO: metadata opcional (no afecta documentos existentes)
      metadata: {
        type: {
          source: {
            type: String,
            enum: ["listing", "faq", "fallback", "human"]
          },
          detectedField: String,
          listingMapId: Number,
          confidence: Number,
          processingTime: Number
        },
        default: () => ({}) // Objeto vacío por defecto
      }
    }
  ],
  // 🔹 NUEVO: campos adicionales opcionales
  lastActivity: {
    type: Date,
    default: Date.now
  },
  summary: {
    type: {
      totalMessages: { type: Number, default: 0 },
      needsHumanSupport: { type: Boolean, default: false },
      commonTopics: { type: [String], default: [] },
      satisfactionScore: { type: Number, default: null }
    },
    default: () => ({
      totalMessages: 0,
      needsHumanSupport: false,
      commonTopics: [],
      satisfactionScore: null
    })
  }
});

// Índices optimizados
ConversationSchema.index({ guestId: 1, lastActivity: -1 });

// Middleware para actualizar estadísticas automáticamente
ConversationSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  
  // Solo actualizar si summary existe (compatibilidad)
  if (this.summary) {
    this.summary.totalMessages = this.messages ? this.messages.length : 0;
  }
  
  next();
});

module.exports = mongoose.model("Conversation", ConversationSchema, "Conversation");