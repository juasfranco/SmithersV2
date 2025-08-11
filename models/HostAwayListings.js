const mongoose = require("mongoose");

const HostAwayListingsSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("HostAwayListings", HostAwayListingsSchema, "HostAwayListings");
