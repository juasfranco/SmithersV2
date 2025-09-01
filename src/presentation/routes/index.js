// src/presentation/routes/index.js
const express = require('express');
const webhookRoutes = require('./webhookRoutes');
const adminRoutes = require('./adminRoutes');
const debugRoutes = require('./debugRoutes');

function createRoutes(container) {
  const router = express.Router();

  // Mount route modules
  router.use('/webhooks', webhookRoutes(container));
  router.use('/admin', adminRoutes(container));
  router.use('/debug', debugRoutes(container));

  return router;
}