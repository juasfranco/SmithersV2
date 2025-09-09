// src/infraestructure/external/hostaway/HostawayClient.js
const axios = require('axios');

class HostawayClient {
  constructor(baseURL, timeout = 80000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.token = null;
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }

  setToken(token) {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async request(config) {
    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async get(endpoint, headers = {}) {
    return this.request({
      method: 'GET',
      url: endpoint,
      headers
    });
  }

  async post(endpoint, data, headers = {}) {
    return this.request({
      method: 'POST',
      url: endpoint,
      data,
      headers
    });
  }
}

module.exports = { HostawayClient };