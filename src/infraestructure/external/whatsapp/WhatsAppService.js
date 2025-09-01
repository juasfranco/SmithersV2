// src/infraestructure/external/whatsapp/WhatsAppService.js
const axios = require('axios');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');

class WhatsAppService {
  constructor({ apiUrl, apiToken, phoneNumber }) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
    this.phoneNumber = phoneNumber;
    this.logger = new SecureLogger();
  }

  async sendNotification({
    guestId,
    reservationId,
    message,
    priority,
    type,
    ticketId
  }) {
    try {
      this.logger.info('Sending WhatsApp notification', {
        guestId,
        priority,
        type
      });

      const notificationMessage = this.formatNotificationMessage({
        guestId,
        reservationId,
        message,
        priority,
        type,
        ticketId
      });

      const response = await axios.post(`${this.apiUrl}/messages`, {
        to: this.phoneNumber,
        message: notificationMessage
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.status === 200) {
        this.logger.info('WhatsApp notification sent successfully', {
          guestId,
          messageId: response.data.id
        });
        return response.data;
      }

      throw new Error(`WhatsApp API returned status ${response.status}`);

    } catch (error) {
      this.logger.error('Failed to send WhatsApp notification', {
        error: error.message,
        guestId,
        type
      });
      throw error;
    }
  }

  formatNotificationMessage({
    guestId,
    reservationId,
    message,
    priority,
    type,
    ticketId
  }) {
    const priorityEmoji = {
      'low': '🔵',
      'medium': '🟡',
      'high': '🔴'
    };

    const typeEmoji = {
      'support': '🆘',
      'error': '⚠️',
      'info': 'ℹ️'
    };

    return `${priorityEmoji[priority] || '🔵'} ${typeEmoji[type] || '📝'} SMITHERS ALERT

📋 Ticket: ${ticketId || 'N/A'}
👤 Guest: ${guestId}
🏠 Reservation: ${reservationId}
⚡ Priority: ${priority.toUpperCase()}

💬 Message: ${message}

📅 ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}`;
  }

  async healthCheck() {
    try {
      // Simple ping to verify service is available
      const response = await axios.get(`${this.apiUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        timeout: 10000
      });

      return {
        healthy: response.status === 200,
        status: 'connected'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async shutdown() {
    this.logger.info('WhatsApp service shutdown');
  }
}

module.exports = { WhatsAppService };