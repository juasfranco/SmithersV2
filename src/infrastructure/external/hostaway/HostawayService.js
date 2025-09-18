const axios = require('axios');
const { TokenManager } = require('../../security/TokenManager');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');
const { HostawayClient } = require('./HostawayClient');

class HostawayService {
  constructor() {
    this.baseURL = 'https://api.hostaway.com/v1';
    this.tokenManager = new TokenManager();
    this.logger = new SecureLogger();
    this.initialized = false;
    this.client = null;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 3;
  }

  async initialize() {
    try {
      this.initializationAttempts++;
      this.logger.info('Initializing Hostaway service', {
        attempt: this.initializationAttempts,
        maxAttempts: this.maxInitializationAttempts
      });

      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain Hostaway token');
      }
      
      // Create Hostaway client with the token
      this.client = new HostawayClient(this.baseURL);
      this.client.setToken(token);
      
      // Verify the token works by making a test request
      await this.testConnection();
      
      this.initialized = true;
      this.logger.info('Hostaway service initialized successfully', {
        baseURL: this.baseURL
      });
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Hostaway service', {
        error: error.message,
        attempt: this.initializationAttempts,
        maxAttempts: this.maxInitializationAttempts
      });

      if (this.initializationAttempts < this.maxInitializationAttempts) {
        this.logger.info('Retrying initialization...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.initialize();
      }

      throw error;
    }
  }

  async testConnection() {
    try {
      // Make a simple test request
      await this.client.get('/listings?limit=1');
      this.logger.info('Hostaway connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Hostaway connection test failed', {
        error: error.message
      });
      return false;
    }
  }

  async getCompleteContext(reservationId, conversationId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Getting complete context from Hostaway', {
        reservationId,
        conversationId
      });

      // Get reservation details first (most important)
      this.logger.debug('Fetching reservation details', { reservationId });
      const reservationResponse = await this.client.get(`/reservations/${reservationId}`);
      const reservation = reservationResponse.result;
      this.logger.debug('Reservation fetched successfully', { 
        reservationId, 
        listingMapId: reservation.listingMapId 
      });

      // Try to get conversation history (optional)
      let messages = [];
      try {
        this.logger.debug('Fetching conversation messages', { reservationId });
        const messagesResponse = await this.client.get(`/reservations/${reservationId}/messages`);
        messages = messagesResponse.result || [];
        this.logger.debug('Messages fetched successfully', { 
          reservationId, 
          messageCount: messages.length 
        });
      } catch (messageError) {
        this.logger.warn('Could not fetch messages, continuing without them', {
          reservationId,
          error: messageError.message
        });
      }

      // Try to get listing details (optional)
      let listing = null;
      if (reservation.listingMapId) {
        try {
          this.logger.debug('Fetching listing details', { 
            listingMapId: reservation.listingMapId 
          });
          const listingResponse = await this.client.get(`/listings/${reservation.listingMapId}`);
          listing = listingResponse.result;
          this.logger.debug('Listing fetched successfully', { 
            listingMapId: reservation.listingMapId,
            listingName: listing?.name 
          });
        } catch (listingError) {
          this.logger.warn('Could not fetch listing details, using fallback', {
            listingMapId: reservation.listingMapId,
            error: listingError.message
          });
          listing = {
            id: reservation.listingMapId,
            name: 'Property'
          };
        }
      }

      return {
        reservation,
        listing,
        messages,
        conversationId
      };
    } catch (error) {
      this.logger.error('Failed to get complete context', {
        reservationId,
        conversationId,
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      const cachedToken = this.tokenManager.retrieve('hostaway_token');
      if (cachedToken && this.tokenManager.isValid('hostaway_token')) {
        this.logger.debug('Using cached Hostaway token');
        return cachedToken;
      }

      this.logger.debug('Requesting new Hostaway token');

      const accountId = process.env.HOSTAWAY_ACCOUNT_ID;
      const clientSecret = process.env.HOSTAWAY_CLIENT_SECRET;

      if (!accountId || !clientSecret) {
        throw new Error('Missing Hostaway credentials in environment variables');
      }

      const tokenEndpoint = `${this.baseURL}/accessTokens`;
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-control': 'no-cache'
      };

      // Datos requeridos para la autenticación con Hostaway
      const data = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: accountId,
        client_secret: clientSecret,
        scope: 'general'
      });

      const response = await axios.post(tokenEndpoint, data, { headers });

      if (!response.data?.access_token) {
        throw new Error('Invalid response from Hostaway token endpoint');
      }

      const token = response.data.access_token;
      
      // Cache the token
      const expiresIn = response.data.expires_in || 3600;
      this.tokenManager.store('hostaway_token', token, expiresIn);
      
      this.logger.info('New Hostaway token obtained successfully', {
        expiresIn: `${expiresIn} seconds`
      });
      return token;

    } catch (error) {
      this.logger.error('Failed to obtain Hostaway token', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  async getListing(listingMapId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.get(`/listings/${listingMapId}`);
      return response.result;
    } catch (error) {
      this.logger.error('Failed to get listing', {
        listingMapId,
        error: error.message
      });
      throw error;
    }
  }

  async getReservation(reservationId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.get(`/reservations/${reservationId}`);
      return response.result;
    } catch (error) {
      this.logger.error('Failed to get reservation', {
        reservationId,
        error: error.message
      });
      throw error;
    }
  }

  async sendMessage(reservationId, message) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.post(`/reservations/${reservationId}/messages`, {
        message,
        type: 'host_to_guest'
      });
      return response.result;
    } catch (error) {
      this.logger.error('Failed to send message', {
        reservationId,
        error: error.message
      });
      throw error;
    }
  }

  // Alias method for backward compatibility and clearer naming
  async sendMessageToGuest(reservationId, message) {
    this.logger.info('Sending message to guest', {
      reservationId,
      messageLength: message?.length
    });
    
    return await this.sendMessage(reservationId, message);
  }

  async getConversationHistory(reservationId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.get(`/reservations/${reservationId}/messages`);
      return response.result;
    } catch (error) {
      this.logger.error('Failed to get conversation history', {
        reservationId,
        error: error.message
      });
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          healthy: false,
          error: 'Service not initialized'
        };
      }

      await this.testConnection();
      
      return {
        healthy: true,
        status: 'Connected',
        baseURL: this.baseURL
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async cleanup() {
    try {
      this.logger.info('Cleaning up Hostaway service...');
      
      // Clear any stored tokens
      if (this.tokenManager) {
        // Clear tokens if there's a method for it
        // this.tokenManager.clearTokens();
      }
      
      // Reset initialization state
      this.initialized = false;
      this.client = null;
      this.initializationAttempts = 0;
      
      this.logger.info('Hostaway service cleanup completed');
    } catch (error) {
      this.logger.error('Error during Hostaway service cleanup', {
        error: error.message
      });
    }
  }
}

module.exports = { HostawayService };
