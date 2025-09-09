// src/infraestructure/external/whatsapp/WhatsAppClient.js
const axios = require('axios');

class WhatsAppClient {
  constructor(apiUrl, apiToken) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async sendMessage(to, message) {
    try {
      const response = await this.client.post('/messages', {
        to,
        message
      });
      return response.data;
    } catch (error) {
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }

  async getStatus() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`WhatsApp API health check failed: ${error.message}`);
    }
  }
}

module.exports = { WhatsAppClient };