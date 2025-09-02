// src/domain/entities/SupportTicket.js
class SupportTicket {
  constructor({
    guestId,
    reservationId,
    listingMapId,
    question,
    reason,
    priority = 'medium',
    status = 'open',
    assignedTo = null,
    resolution = null,
    metadata = {}
  }) {
    this.validateRequired({ guestId, reservationId, question, reason });
    this.validatePriority(priority);
    this.validateStatus(status);
    
    this.guestId = guestId;
    this.reservationId = reservationId;
    this.listingMapId = listingMapId;
    this.question = this.sanitizeText(question);
    this.reason = this.sanitizeText(reason);
    this.priority = priority;
    this.status = status;
    this.assignedTo = assignedTo;
    this.resolution = resolution ? this.sanitizeText(resolution) : null;
    this.metadata = this.sanitizeMetadata(metadata);
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  validateRequired(fields) {
    Object.entries(fields).forEach(([key, value]) => {
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        throw new Error(`${key} is required`);
      }
    });
  }

  validatePriority(priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }
  }

  validateStatus(status) {
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  sanitizeText(text) {
    if (!text) return '';
    return text.toString().trim().substring(0, 2000);
  }

  sanitizeMetadata(metadata) {
    const sanitized = {};
    const allowedKeys = ['response', 'error', 'resolvedAt', 'resolvedBy', 'context'];
    
    allowedKeys.forEach(key => {
      if (metadata[key] !== undefined) {
        sanitized[key] = metadata[key];
      }
    });
    
    return sanitized;
  }

  assignTo(userId) {
    this.assignedTo = userId;
    this.status = 'in_progress';
    this.updatedAt = new Date();
  }

  resolve(resolution, resolvedBy) {
    this.validateRequired({ resolution, resolvedBy });
    
    this.resolution = this.sanitizeText(resolution);
    this.status = 'resolved';
    this.metadata.resolvedAt = new Date();
    this.metadata.resolvedBy = resolvedBy;
    this.updatedAt = new Date();
  }

  close() {
    this.status = 'closed';
    this.updatedAt = new Date();
  }

  isOpen() {
    return this.status === 'open' || this.status === 'in_progress';
  }

  isResolved() {
    return this.status === 'resolved' || this.status === 'closed';
  }
}

module.exports = {SupportTicket};