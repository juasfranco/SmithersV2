// src/presentation/routes/debugRoutes.js
const express = require('express');

function createDebugRoutes(container) {
  const router = express.Router();
  const adminController = container.get('adminController');
  const authMiddleware = container.get('authMiddleware');

  // Debug routes require API key in development/staging
  if (process.env.NODE_ENV !== 'production') {
    router.use(authMiddleware.requireApiKey());
  }

  // Conversation debug
  router.get('/conversations', (req, res) => adminController.getConversationDebug(req, res));

  // Health check for dependencies
  router.get('/health', async (req, res) => {
    try {
      const healthResults = await req.container.healthCheck();
      res.json({
        timestamp: new Date().toISOString(),
        dependencies: healthResults
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

module.exports = createRoutes;

// Export route creators
module.exports.webhookRoutes = createWebhookRoutes;
module.exports.adminRoutes = createAdminRoutes;
module.exports.debugRoutes = createDebugRoutes;

// Start the server if this file is run directly
if (require.main === module) {
  const server = new Server();
  
  server.start().catch(error => {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  });
}

module.exports = Server;