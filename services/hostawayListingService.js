const HostawayListing = require("../models/HostawayListing");

async function getAllListings() {
  return await HostawayListing.find({});
}

async function getListingById(id) {
  return await HostawayListing.findById(id);
}

module.exports = { getAllListings, getListingById };
