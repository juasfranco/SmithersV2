const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  guestId: {
    type: String,
    required: true
  },
  reservationId: {
    type: String,
    required: true
  },
  listingId: String,
  type: {
    type: String,
    enum: ['error', 'support', 'feedback', 'other'],
    default: 'error'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  description: {
    type: String,
    required: true
  },
  error: {
    message: String,
    stack: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Esto maneja automáticamente createdAt y updatedAt
});

// Índices para búsquedas comunes
supportTicketSchema.index({ guestId: 1 });
supportTicketSchema.index({ reservationId: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ createdAt: 1 });

const SupportTicketModel = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = { SupportTicketModel };
