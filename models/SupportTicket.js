// models/SupportTicket.js - CORREGIDO SIN DUPLICACIÓN
const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema({
  guestId: {
    type: String,
    required: true,
    index: true
  },
  reservationId: {
    type: String,
    required: true
  },
  listingMapId: {
    type: Number,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "resolved", "closed"],
    default: "open"
  },
  assignedTo: {
    type: String,
    default: null
  },
  resolution: {
    type: String,
    default: null
  },
  metadata: {
    response: String,
    error: String,
    resolvedAt: Date,
    resolvedBy: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
SupportTicketSchema.index({ guestId: 1, createdAt: -1 });

SupportTicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);