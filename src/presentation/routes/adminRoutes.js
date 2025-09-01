// src/presentation/routes/adminRoutes.js
const express = require('express');

function createAdminRoutes(container) {
  const router = express.Router();
  const adminController = container.get('adminController');
  const authMiddleware = container.get('authMiddleware');

  // All admin routes require API key
  router.use(authMiddleware.requireApiKey());

  // Statistics endpoint
  router.get('/stats', (req, res) => adminController.getStatistics(req, res));

  // Test endpoints
  router.post('/test/save-conversation', (req, res) => adminController.testSaveConversation(req, res));

  return router;
}