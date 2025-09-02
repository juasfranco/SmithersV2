// src/domain/services/NotificationService.js
class NotificationService {
  constructor({ whatsappService, emailService }) {
    this.whatsappService = whatsappService;
    this.emailService = emailService;
  }

  async sendSupportNotification(data) {
    const notifications = [];

    if (this.whatsappService) {
      try {
        await this.whatsappService.sendNotification(data);
        notifications.push('whatsapp');
      } catch (error) {
        console.error('WhatsApp notification failed:', error.message);
      }
    }

    if (this.emailService && data.priority === 'high') {
      try {
        await this.emailService.sendNotification(data);
        notifications.push('email');
      } catch (error) {
        console.error('Email notification failed:', error.message);
      }
    }

    return notifications;
  }
}

module.exports = { NotificationService };