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

  return router;
}