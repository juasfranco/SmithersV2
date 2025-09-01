// src/presentation/routes/index.js
const express = require('express');

// Import route creators
const createWebhookRoutes = require('./webhookRoutes');
const createAdminRoutes = require('./adminRoutes');
const createDebugRoutes = require('./debugRoutes');

function createRoutes(container) {
  const router = express.Router();

  // Mount route modules
  router.use('/webhooks', createWebhookRoutes(container));
  router.use('/admin', createAdminRoutes(container));
  router.use('/debug', createDebugRoutes(container));

  return router;
}

module.exports = createRoutes;