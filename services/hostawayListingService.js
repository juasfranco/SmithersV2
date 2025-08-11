const mongoose = require("mongoose");
const HostawayListings = require("../models/HostAwayListings");

async function getListingByMapId(listingMapId) {
  if (!listingMapId) return null;

  try {
    // Forzar conversión a número si es numérico
    const idNum = Number(listingMapId);

    // Intentar búsqueda como número primero
    let listing = await HostawayListings.findOne({ ListingMapId: idNum }).lean();

    // Si no se encuentra como número, probar como string
    if (!listing) {
      listing = await HostawayListings.findOne({ ListingMapId: String(listingMapId) }).lean();
    }

    if (listing) {
      console.log("✅ Listing encontrado:", listing._id);
      return listing;
    }

    console.log("❌ No se encontró listing con ListingMapId:", listingMapId);
    return null;
  } catch (err) {
    console.error("⚠️ Error buscando listing por ListingMapId:", err.message);
    return null;
  }
}

module.exports = { getListingByMapId };
