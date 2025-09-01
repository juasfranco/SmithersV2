// src/domain/repositories/IConversationRepository.js
class IConversationRepository {
  async save(conversation) {
    throw new Error('Method save must be implemented');
  }

  async findByGuestId(guestId) {
    throw new Error('Method findByGuestId must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById must be implemented');
  }

  async update(id, updates) {
    throw new Error('Method update must be implemented');
  }

  async delete(id) {
    throw new Error('Method delete must be implemented');
  }

  async findRecentActive(hours = 24) {
    throw new Error('Method findRecentActive must be implemented');
  }

  async getStatistics() {
    throw new Error('Method getStatistics must be implemented');
  }
}
module.exports = { IConversationRepository };