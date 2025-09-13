// src/domain/repositories/ISupportTicketRepository.js
class ISupportTicketRepository {
  async save(ticket) {
    throw new Error('Method save must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById must be implemented');
  }

  async findByGuestId(guestId) {
    throw new Error('Method findByGuestId must be implemented');
  }

  async findByStatus(status) {
    throw new Error('Method findByStatus must be implemented');
  }

  async findByPriority(priority) {
    throw new Error('Method findByPriority must be implemented');
  }

  async update(id, updates) {
    throw new Error('Method update must be implemented');
  }

  async getStatistics() {
    throw new Error('Method getStatistics must be implemented');
  }

  async findOpen() {
    throw new Error('Method findOpen must be implemented');
  }
}

module.exports = {ISupportTicketRepository};