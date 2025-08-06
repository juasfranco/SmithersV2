const mongoose = require("mongoose");

const HostawayListingSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("HostawayListing", HostawayListingSchema);
