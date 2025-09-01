// src/infrastructure/external/hostaway/HostawayService.js
const axios = require('axios');
const { TokenManager } = require('../../security/TokenManager');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');

class HostawayService {
  constructor() {
    this.baseURL = 'https://api.hostaway.com/v1';
    this.tokenManager = new TokenManager();
    this.logger = new SecureLogger();
    this.initialized = false;
  }

  async initialize() {
    try {
      await this.getAccessToken();
      this.initialized = true;
      this.logger.info('Hostaway service initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Hostaway service', {
        error: error.message
      });
      throw error;
    }
  }

  async getAccessToken() {
    // Check if we have a valid cached token
    const cachedToken = this.tokenManager.retrieve('hostaway_token');
    if (cachedToken) {
      return cachedToken;
    }

    try {
      this.logger.debug('Requesting new Hostaway token');

      const formData = `grant_type=client_credentials&client_id=${process.env.HOSTAWAY_ACCOUNT_ID}&client_secret=${process.env.HOSTAWAY_CLIENT_SECRET}&scope=general`;

      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/accessTokens`,
        data: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        timeout: 60000
      });

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in * 1000; // Convert to ms
      
      // Store token with expiration
      this.tokenManager.store('hostaway_token', token, expiresIn - 30000); // 30s buffer
      
      this.logger.info('Hostaway token obtained successfully');
      return token;

    } catch (error) {
      this.logger.error('Failed to get Hostaway token', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  async apiRequest(method, endpoint, data = null) {
    try {
      const token = await this.getAccessToken();
      
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 60000
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      // If token expired, invalidate and retry once
      if (error.response?.status === 401) {
        this.tokenManager.revoke('hostaway_token');
        
        if (!arguments[3]) { // Prevent infinite recursion
          return this.apiRequest(method, endpoint, data, true);
        }
      }

      this.logger.error(`Hostaway API error ${method} ${endpoint}`, {
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.apiRequest('GET', '/me');
      return true;
    } catch (error) {
      // Try with listings endpoint if /me fails
      try {
        await this.apiRequest('GET', '/listings?limit=1');
        return true;
      } catch {
        return false;
      }
    }
  }

  async getCompleteContext(reservationId, conversationId = null) {
    try {
      // Get reservation data
      const reservation = await this.apiRequest('GET', `/reservations/${reservationId}?includeResources=1`);
      
      let listing = null;
      if (reservation.result?.listingMapId) {
        try {
          listing = await this.apiRequest('GET', `/listings/${reservation.result.listingMapId}?includeResources=1`);
        } catch (listingError) {
          this.logger.warn('Could not fetch listing data', {
            listingMapId: reservation.result.listingMapId,
            error: listingError.message
          });
        }
      }

      let messages = [];
      if (conversationId) {
        try {
          const messageResponse = await this.apiRequest('GET', 
            `/conversations/${conversationId}/messages?limit=10&sortOrder=createdAtDesc`
          );
          messages = messageResponse.result || [];
        } catch (messageError) {
          this.logger.warn('Could not fetch conversation messages', {
            conversationId,
            error: messageError.message
          });
        }
      }

      return {
        reservation: {
          id: reservation.result.id,
          listingMapId: reservation.result.listingMapId,
          guestName: reservation.result.guestName,
          guestEmail: reservation.result.guestEmail,
          guestPhone: reservation.result.guestPhone,
          checkInDate: reservation.result.arrivalDate,
          checkOutDate: reservation.result.departureDate,
          numberOfGuests: reservation.result.numberOfGuests,
          status: reservation.result.status,
          totalPrice: reservation.result.totalPrice,
          currency: reservation.result.currencyCode,
          source: reservation.result.channelName
        },
        listing: listing ? {
          id: listing.result.id,
          name: listing.result.name,
          address: listing.result.address,
          checkInTime: listing.result.checkInTimeStart,
          checkOutTime: listing.result.checkOutTime,
          wifiUsername: listing.result.wifiUsername,
          wifiPassword: listing.result.wifiPassword,
          doorCode: listing.result.doorSecurityCode,
          specialInstructions: listing.result.specialInstruction,
          houseRules: listing.result.houseRules,
          contactName: listing.result.contactName,
          contactPhone: listing.result.contactPhone1,
          contactEmail: listing.result.contactEmail
        } : null,
        conversation: {
          id: conversationId,
          recentMessages: messages.map(msg => ({
            id: msg.id,
            type: msg.type,
            message: msg.message,
            sentAt: msg.insertedOn,
            isFromGuest: msg.type === 'inquiry'
          }))
        }
      };

    } catch (error) {
      this.logger.error('Error getting complete context', {
        reservationId,
        conversationId,
        error: error.message
      });
      throw error;
    }
  }

  async sendMessageToGuest(reservationId, message) {
    try {
      const response = await this.apiRequest('POST', '/messages', {
        reservationId: parseInt(reservationId),
        message: message,
        type: 'inquiry'
      });

      if (response.status === 'success') {
        this.logger.info('Message sent to guest', {
          reservationId,
          messageId: response.result?.id
        });
        return response.result;
      }

      return null;
    } catch (error) {
      this.logger.error('Error sending message to guest', {
        reservationId,
        error: error.message
      });
      throw error;
    }
  }

  async healthCheck() {
    try {
      const isConnected = await this.testConnection();
      return {
        healthy: isConnected,
        initialized: this.initialized,
        hasToken: this.tokenManager.isValid('hostaway_token')
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async shutdown() {
    this.tokenManager.revoke('hostaway_token');
    this.logger.info('Hostaway service shutdown');
  }
}

module.exports = {
  DependencyContainer,
  OpenAIService,
  HostawayService
};