// src/presentation/controllers/WebhookController.js
const { WebhookDto } = require('../../application/dto/WebhookDto');
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class WebhookController {
  constructor({ processWebhookUseCase, rateLimiter }) {
    this.processWebhookUseCase = processWebhookUseCase;
    this.rateLimiter = rateLimiter;
    this.logger = new SecureLogger();
  }

  async handleHostawayWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Webhook received', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        event: req.body?.event || 'unknown'
      });

      // Rate limiting check
      const rateLimitResult = this.rateLimiter.isAllowed(req.ip);
      if (!rateLimitResult.allowed) {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          resetTime: rateLimitResult.resetTime
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        });
      }

      // Validate request body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        this.logger.warn('Empty webhook payload received', {
          ip: req.ip,
          contentType: req.get('Content-Type')
        });

        return res.status(400).json({
          error: 'Request body is required',
          timestamp: new Date().toISOString()
        });
      }

      // Create DTO from raw request
      let webhookDto;
      try {
        webhookDto = new WebhookDto(req.body);
      } catch (dtoError) {
        this.logger.error('Failed to create WebhookDto', {
          error: dtoError.message,
          body: req.body
        });

        return res.status(400).json({
          error: 'Invalid webhook data format',
          details: dtoError.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate DTO
      const validation = webhookDto.validate();
      if (!validation.isValid) {
        this.logger.warn('Invalid webhook payload', {
          errors: validation.errors,
          event: webhookDto.event,
          reservationId: webhookDto.reservationId
        });
        
        return res.status(400).json({
          error: 'Invalid webhook payload',
          details: validation.errors,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.debug('Webhook validation passed', {
        event: webhookDto.event,
        reservationId: webhookDto.reservationId,
        hasMessage: !!webhookDto.message
      });

      // Process webhook
      const result = await this.processWebhookUseCase.execute(webhookDto);

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Webhook processed successfully', {
        event: webhookDto.event,
        reservationId: webhookDto.reservationId,
        processingTime,
        success: result.success
      });

      return res.status(200).json({
        success: true,
        event: webhookDto.event,
        processingTime,
        timestamp: new Date().toISOString(),
        result: {
          processed: true,
          context: result.context || null
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Webhook processing failed', {
        error: error.message,
        stack: error.stack,
        processingTime,
        event: req.body?.event,
        reservationId: req.body?.reservationId,
        ip: req.ip
      });

      // Return error response but don't expose internal details
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return res.status(500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        processingTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Additional method for handling different webhook types
  async handleGenericWebhook(req, res) {
    try {
      this.logger.info('Generic webhook received', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });

      // Basic validation
      if (!req.body) {
        return res.status(400).json({
          error: 'Request body is required'
        });
      }

      // Process generic webhook
      this.logger.info('Generic webhook processed', {
        type: req.body.type || 'unknown'
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook received',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Generic webhook processing failed', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }

  // Health check method for the webhook controller
  async healthCheck(req, res) {
    try {
      const health = {
        controller: 'WebhookController',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        rateLimiter: {
          active: !!this.rateLimiter,
          type: this.rateLimiter.constructor.name
        },
        useCase: {
          active: !!this.processWebhookUseCase,
          type: this.processWebhookUseCase.constructor.name
        }
      };

      return res.status(200).json(health);

    } catch (error) {
      this.logger.error('Webhook controller health check failed', {
        error: error.message
      });

      return res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Método específico para testing con Hostaway
  async testWebhookEndpoint(req, res) {
    try {
      this.logger.info('🧪 Test webhook endpoint called', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        ip: req.ip
      });

      // Log detalles para debugging
      const testInfo = {
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: {
          'content-type': req.get('Content-Type'),
          'user-agent': req.get('User-Agent'),
          'content-length': req.get('Content-Length'),
          'authorization': req.get('Authorization') ? '[HIDDEN]' : 'not provided',
        },
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip,
        endpoint: 'TEST ENDPOINT - This would be processed by handleHostawayWebhook'
      };

      console.log('\n' + '='.repeat(80));
      console.log('🧪 WEBHOOK TEST ENDPOINT CALLED');
      console.log('='.repeat(80));
      console.log(JSON.stringify(testInfo, null, 2));
      console.log('='.repeat(80) + '\n');

      // Si hay un body, simular el procesamiento
      if (req.body && Object.keys(req.body).length > 0) {
        try {
          const webhookDto = new WebhookDto(req.body);
          const validation = webhookDto.validate();
          
          console.log('📋 Webhook DTO Validation:');
          console.log(`   Valid: ${validation.isValid}`);
          if (!validation.isValid) {
            console.log(`   Errors: ${JSON.stringify(validation.errors, null, 2)}`);
          }
          console.log(`   Event: ${webhookDto.event}`);
          console.log(`   Reservation ID: ${webhookDto.reservationId}`);
          console.log('');
        } catch (error) {
          console.log(`❌ DTO Creation Failed: ${error.message}\n`);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Test endpoint received your webhook!',
        receivedAt: new Date().toISOString(),
        data: testInfo,
        note: 'This is a test endpoint. Real webhooks should use /webhooks/hostaway'
      });

    } catch (error) {
      this.logger.error('Test webhook endpoint error', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = { WebhookController };