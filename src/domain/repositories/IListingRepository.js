// src/domain/repositories/IListingRepository.js
class IListingRepository {
  async findById(listingId) {
    throw new Error('Method findById must be implemented');
  }

  async findByMapId(listingMapId) {
    throw new Error('Method findByMapId must be implemented');
  }

  async search(criteria) {
    throw new Error('Method search must be implemented');
  }

  async save(listing) {
    throw new Error('Method save must be implemented');
  }

  async update(id, updates) {
    throw new Error('Method update must be implemented');
  }

  async findAll() {
    throw new Error('Method findAll must be implemented');
  }
}
module.exports = { IListingRepository };