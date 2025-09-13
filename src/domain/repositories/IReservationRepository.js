// src/domain/repositories/IReservationRepository.js
class IReservationRepository {
  async findById(reservationId) {
    throw new Error('Method findById must be implemented');
  }

  async search(filters) {
    throw new Error('Method search must be implemented');
  }

  async save(reservation) {
    throw new Error('Method save must be implemented');
  }

  async update(id, updates) {
    throw new Error('Method update must be implemented');
  }

  async findByGuestEmail(email) {
    throw new Error('Method findByGuestEmail must be implemented');
  }

  async findActive() {
    throw new Error('Method findActive must be implemented');
  }

  async findUpcoming(days = 30) {
    throw new Error('Method findUpcoming must be implemented');
  }
}
module.exports = { IReservationRepository };