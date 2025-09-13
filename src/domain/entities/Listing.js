// src/domain/entities/Listing.js
class Listing {
  constructor({
    id,
    name,
    address,
    checkInTime,
    checkOutTime,
    wifiUsername,
    wifiPassword,
    doorCode,
    specialInstructions,
    houseRules,
    contactName,
    contactPhone,
    contactEmail
  }) {
    this.id = id;
    this.name = this.sanitizeString(name);
    this.address = this.sanitizeString(address);
    this.checkInTime = this.sanitizeString(checkInTime);
    this.checkOutTime = this.sanitizeString(checkOutTime);
    this.wifiUsername = this.sanitizeString(wifiUsername);
    this.wifiPassword = wifiPassword; // Keep original for functionality
    this.doorCode = doorCode; // Keep original for functionality
    this.specialInstructions = this.sanitizeString(specialInstructions);
    this.houseRules = this.sanitizeString(houseRules);
    this.contactName = this.sanitizeString(contactName);
    this.contactPhone = this.sanitizeString(contactPhone);
    this.contactEmail = this.validateEmail(contactEmail);
  }

  sanitizeString(str) {
    if (!str) return null;
    return str.toString().trim();
  }

  validateEmail(email) {
    if (!email) return null;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return null; // Don't throw error for listing data
    }
    
    return email.toLowerCase();
  }

  // Get sensitive information (only for authorized access)
  getSensitiveInfo() {
    return {
      wifiPassword: this.wifiPassword,
      doorCode: this.doorCode
    };
  }

  // Get public information
  getPublicInfo() {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      checkInTime: this.checkInTime,
      checkOutTime: this.checkOutTime,
      contactName: this.contactName,
      contactPhone: this.contactPhone,
      contactEmail: this.contactEmail
    };
  }
}

module.exports = { Listing };