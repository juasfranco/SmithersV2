// src/infrastructure/database/mongodb/models/ListingModel.js
const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema({}, { 
  strict: false,
  timestamps: true 
});

// Essential indexes
ListingSchema.index({ ListingMapId: 1 });
ListingSchema.index({ Name: 1 });
ListingSchema.index({ City: 1 });

module.exports = mongoose.model("HostAwayListings", ListingSchema, "HostAwayListings");

module.exports = {
  DatabaseConnection,
  MongoConversationRepository,
  MongoListingRepository
};