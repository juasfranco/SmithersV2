// src/domain/entities/Reservation.js
class Reservation {
  constructor({
    id,
    listingMapId,
    guestName,
    guestEmail,
    guestPhone,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    status,
    totalPrice,
    currency,
    source
  }) {
    this.validateId(id);
    this.validateDates(checkInDate, checkOutDate);
    
    this.id = id;
    this.listingMapId = listingMapId;
    this.guestName = this.sanitizeString(guestName);
    this.guestEmail = this.validateEmail(guestEmail);
    this.guestPhone = this.sanitizeString(guestPhone);
    this.checkInDate = new Date(checkInDate);
    this.checkOutDate = new Date(checkOutDate);
    this.numberOfGuests = parseInt(numberOfGuests) || 1;
    this.status = status;
    this.totalPrice = parseFloat(totalPrice) || 0;
    this.currency = currency || 'USD';
    this.source = this.sanitizeString(source);
  }

  validateId(id) {
    if (!id) {
      throw new Error('Reservation ID is required');
    }
  }

  validateDates(checkIn, checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new Error('Invalid check-in or check-out date');
    }
    
    if (checkInDate >= checkOutDate) {
      throw new Error('Check-in date must be before check-out date');
    }
  }

  validateEmail(email) {
    if (!email) return null;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    return email.toLowerCase();
  }

  sanitizeString(str) {
    if (!str) return null;
    return str.toString().trim().substring(0, 255);
  }

  isActive() {
    const now = new Date();
    return this.checkInDate <= now && this.checkOutDate > now;
  }

  isUpcoming() {
    const now = new Date();
    return this.checkInDate > now;
  }

  getDuration() {
    return Math.ceil((this.checkOutDate - this.checkInDate) / (1000 * 60 * 60 * 24));
  }
}

module.exports = { Reservation };