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
        contentLength: req.get('Content-Length')
      });

      // Rate limiting check
      const rateLimitResult = this.rateLimiter.isAllowed(req.ip);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        });
      }

      // Create DTO from raw request
      const webhookDto = new WebhookDto(req.body);
      
      // Validate DTO
      const validation = webhookDto.validate();
      if (!validation.isValid) {
        this.logger.warn('Invalid webhook payload', {
          errors: validation.errors,
          body: req.body
        });
        
        return res.status(400).json({
          error: 'Invalid webhook payload',
          details: validation.errors
        });
      }

      // Process webhook
      const result = await this.processWebhookUseCase.execute(webhookDto);

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Webhook processed successfully', {
        event: webhookDto.event,
        processingTime,
        success: result.success
      });

      return res.status(200).json({
        success: true,
        event: webhookDto.event,
        processingTime,
        timestamp: new Date().toISOString(),
        result
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Webhook processing failed', {
        error: error.message,
        processingTime,
        body: req.body
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        processingTime,
        timestamp: new Date().toISOString()
      });
    }
  }
}