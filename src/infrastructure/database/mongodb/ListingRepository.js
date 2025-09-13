// src/infraestructure/database/mongodb/ListingRepository.js
const { SecureLogger } = require('../../../shared/logger/SecureLogger');
const { IListingRepository } = require('../../../domain/repositories/IListingRepository');
const { Listing } = require('../../../domain/entities/Listing');
const ListingModel = require('../models/ListingModel');

class MongoListingRepository extends IListingRepository {
  constructor() {
    super();
    this.logger = new SecureLogger();
  }

  async findById(listingId) {
    try {
      const doc = await ListingModel.findById(listingId).lean();
      return doc ? this.toDomainEntity(doc) : null;
    } catch (error) {
      this.logger.error('Error finding listing by id', { error: error.message, listingId });
      throw error;
    }
  }

  async findByMapId(listingMapId) {
    try {
      this.logger.debug('Searching for listing', { listingMapId });

      // Try as number first
      let doc = await ListingModel.findOne({ ListingMapId: Number(listingMapId) }).lean();
      
      // If not found, try as string
      if (!doc) {
        doc = await ListingModel.findOne({ ListingMapId: String(listingMapId) }).lean();
      }

      if (doc) {
        this.logger.info('Listing found', { 
          listingMapId, 
          name: doc.Name || doc.AirbnbName 
        });
        return this.toDomainEntity(doc);
      }

      this.logger.warn('Listing not found', { listingMapId });
      return null;
    } catch (error) {
      this.logger.error('Error finding listing by mapId', { 
        error: error.message, 
        listingMapId 
      });
      throw error;
    }
  }

  async search(criteria) {
    try {
      const query = {};
      
      if (criteria.name) {
        query.$or = [
          { Name: new RegExp(criteria.name, 'i') },
          { AirbnbName: new RegExp(criteria.name, 'i') }
        ];
      }
      
      if (criteria.city) {
        query.City = new RegExp(criteria.city, 'i');
      }
      
      if (criteria.address) {
        query.$or = [
          { Address: new RegExp(criteria.address, 'i') },
          { PublicAddress: new RegExp(criteria.address, 'i') }
        ];
      }

      const docs = await ListingModel.find(query).lean();
      return docs.map(doc => this.toDomainEntity(doc));
    } catch (error) {
      this.logger.error('Error searching listings', { error: error.message, criteria });
      throw error;
    }
  }

  async save(listing) {
    try {
      const doc = new ListingModel(this.toMongoDocument(listing));
      const saved = await doc.save();
      
      this.logger.info('Listing saved', { id: saved._id });
      return this.toDomainEntity(saved);
    } catch (error) {
      this.logger.error('Error saving listing', { error: error.message });
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const doc = await ListingModel.findByIdAndUpdate(
        id, 
        updates, 
        { new: true }
      );
      return doc ? this.toDomainEntity(doc) : null;
    } catch (error) {
      this.logger.error('Error updating listing', { error: error.message, id });
      throw error;
    }
  }

  async findAll() {
    try {
      const docs = await ListingModel.find({}).lean();
      return docs.map(doc => this.toDomainEntity(doc));
    } catch (error) {
      this.logger.error('Error finding all listings', { error: error.message });
      throw error;
    }
  }

  toDomainEntity(doc) {
    return new Listing({
      id: doc._id,
      name: doc.Name || doc.AirbnbName,
      address: doc.PublicAddress || doc.Address,
      checkInTime: doc.CheckInTimeStart,
      checkOutTime: doc.CheckOutTime,
      wifiUsername: doc.WifiUsername,
      wifiPassword: doc.WifiPassword,
      doorCode: doc.DoorSecurityCode,
      specialInstructions: doc.SpecialInstruction,
      houseRules: doc.HouseRules,
      contactName: doc.ContactName,
      contactPhone: doc.ContactPhone1,
      contactEmail: doc.ContactEmail
    });
  }

  toMongoDocument(listing) {
    return {
      Name: listing.name,
      PublicAddress: listing.address,
      CheckInTimeStart: listing.checkInTime,
      CheckOutTime: listing.checkOutTime,
      WifiUsername: listing.wifiUsername,
      WifiPassword: listing.wifiPassword,
      DoorSecurityCode: listing.doorCode,
      SpecialInstruction: listing.specialInstructions,
      HouseRules: listing.houseRules,
      ContactName: listing.contactName,
      ContactPhone1: listing.contactPhone,
      ContactEmail: listing.contactEmail
    };
  }
}

module.exports = { MongoListingRepository };