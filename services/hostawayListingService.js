// services/hostawayListingService.js
const mongoose = require("mongoose");
const HostawayListings = require("../models/HostAwayListings");

async function getListingByMapId(listingMapId) {
  if (!listingMapId) return null;

  try {
    console.log(`🔍 Buscando listing con ListingMapId: ${listingMapId}`);
    
    // Convertir a número para coincidir con tus datos
    const idNum = Number(listingMapId);

    // 🔹 BÚSQUEDA ESPECÍFICA para tus datos existentes
    let listing = await HostawayListings.findOne({ ListingMapId: idNum }).lean();

    if (!listing) {
      // Fallback: buscar como string si no se encuentra como número
      listing = await HostawayListings.findOne({ ListingMapId: String(listingMapId) }).lean();
    }

    if (listing) {
      console.log("✅ Listing encontrado:", {
        id: listing._id,
        name: listing.Name || listing.AirbnbName,
        mapId: listing.ListingMapId
      });
      
      // 🔹 MAPEAR campos importantes de tu estructura existente
      const mappedListing = {
        ...listing,
        // Campos mapeados para compatibilidad
        checkInTime: listing.CheckInTimeStart,
        checkOutTime: listing.CheckOutTime,
        wifi: listing.WifiUsername || "Ver manual de bienvenida",
        wifiPassword: listing.WifiPassword || "Ver manual de bienvenida", 
        address: listing.PublicAddress || listing.Address,
        phone: listing.ContactPhone1,
        houseRules: listing.HouseRules,
        specialInstruction: listing.SpecialInstruction,
        doorCode: listing.DoorSecurityCode,
        keyPickup: listing.KeyPickup,
        cleaningInstruction: listing.CleaningInstruction
      };
      
      return mappedListing;
    }

    console.log("❌ No se encontró listing con ListingMapId:", listingMapId);
    return null;
    
  } catch (err) {
    console.error("⚠️ Error buscando listing:", err.message);
    return null;
  }
}

// 🔹 NUEVA FUNCIÓN: Buscar por campos específicos de tu estructura
async function searchListingByFields(searchTerm) {
  try {
    const searchRegex = new RegExp(searchTerm, 'i');
    
    const listing = await HostawayListings.findOne({
      $or: [
        { Name: searchRegex },
        { AirbnbName: searchRegex },
        { Address: searchRegex },
        { City: searchRegex }
      ]
    }).lean();
    
    return listing;
  } catch (error) {
    console.error("❌ Error en búsqueda por campos:", error);
    return null;
  }
}

module.exports = { 
  getListingByMapId,
  searchListingByFields 
};