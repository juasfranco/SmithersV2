// src/presentation/routes/healthRoutes.js
const express = require('express');

function createHealthRoutes(container) {
  const router = express.Router();
  const healthController = container.get('healthController');

  // Basic health check
  router.get('/', (req, res) => healthController.getHealthStatus(req, res));

  // Detailed health check
  router.get('/detailed', (req, res) => healthController.getDetailedHealth(req, res));

  return router;
}

module.exports = createHealthRoutes;