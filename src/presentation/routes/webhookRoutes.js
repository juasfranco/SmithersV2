// src/presentation/routes/webhookRoutes.js
const express = require('express');

function createWebhookRoutes(container) {
  const router = express.Router();
  const webhookController = container.get('webhookController');
  const validationMiddleware = container.get('validationMiddleware');

  // Hostaway webhook endpoint
  router.post('/hostaway', 
    validationMiddleware.validateWebhook(),
    (req, res) => webhookController.handleHostawayWebhook(req, res)
  );

  // Test endpoint para debugging (sin validación estricta)
  router.all('/test', (req, res) => webhookController.testWebhookEndpoint(req, res));

  // Health check específico para webhooks
  router.get('/health', (req, res) => webhookController.getHealth(req, res));

  return router;
}

module.exports = createWebhookRoutes;