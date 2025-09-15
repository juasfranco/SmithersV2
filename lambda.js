// lambda.js - AWS Lambda Handler
const serverlessExpress = require('@vendia/serverless-express');
const Server = require('./server');

let serverInstance = null;
let app = null;

// Initialize server instance
const initializeServer = async () => {
  if (!serverInstance) {
    serverInstance = new Server();
    await serverInstance.initialize();
    app = serverInstance.app;
  }
  return app;
};

// Lambda handler
exports.handler = async (event, context) => {
  try {
    // Initialize server if not already done
    const expressApp = await initializeServer();
    
    // Create serverless express handler
    const handler = serverlessExpress({ app: expressApp });
    
    // Handle the request
    return await handler(event, context);
    
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

// Graceful shutdown for container reuse
process.on('SIGTERM', async () => {
  if (serverInstance) {
    await serverInstance.shutdown();
  }
});