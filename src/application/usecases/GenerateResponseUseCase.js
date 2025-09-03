// src/application/usecases/GenerateResponseUseCase.js - Con import correcto
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class GenerateResponseUseCase {
  constructor({
    listingRepository,
    faqRepository,
    conversationRepository,
    aiService
  }) {
    // Validate required dependencies
    if (!listingRepository || !faqRepository || !conversationRepository || !aiService) {
      throw new Error('Missing required dependencies in GenerateResponseUseCase');
    }

    // Validate repository interfaces
    if (typeof listingRepository.findByMapId !== 'function' ||
        typeof faqRepository.findAll !== 'function' ||
        typeof conversationRepository.findByGuestId !== 'function' ||
        typeof aiService.detectField !== 'function') {
      throw new Error('Invalid repository or service implementation');
    }

    this.listingRepository = listingRepository;
    this.faqRepository = faqRepository;
    this.conversationRepository = conversationRepository;
    this.aiService = aiService;
    this.logger = new SecureLogger();
  }

  async execute({ guestId, reservationId, listingMapId, message }) {
    const startTime = Date.now();
    
    // Validate input parameters
    if (!guestId || !reservationId || !message) {
      throw new Error('Missing required parameters');
    }

    try {
      this.logger.debug('Generating response', { 
        guestId, 
        listingMapId,
        messagePreview: message.substring(0, 50) 
      });

      // 1. Get conversation history for context
      const conversation = await this.conversationRepository.findByGuestId(guestId);
      const conversationHistory = conversation ? conversation.getRecentMessages(5) : [];

      // 2. Detect what the user is asking about
      const detectedField = await this.aiService.detectField(message, conversationHistory);
      
      this.logger.debug('Field detected', { detectedField });

      // 3. Try to find answer in listing data
      let response = null;
      let source = 'unknown';
      let confidence = 0;
      let requiresEscalation = false;
      let escalationReason = null;

      if (listingMapId) {
        const listing = await this.listingRepository.findByMapId(listingMapId);
        if (listing) {
          const listingAnswer = this.findAnswerInListing(listing, detectedField, message);
          if (listingAnswer) {
            const aiResponse = await this.aiService.generateFriendlyResponse(message, listingAnswer, conversationHistory);
            response = aiResponse.response;
            confidence = aiResponse.confidence;
            source = 'listing';
            
            // Check if confidence is too low
            if (confidence < 0.7) {
              requiresEscalation = true;
              escalationReason = 'Low confidence in AI response';
            }
            
            this.logger.info('Answer found in listing data', { 
              field: detectedField,
              listingId: listing.id,
              confidence
            });
          }
        }
      }

      // 4. If not found in listing, search FAQs
      if (!response) {
        const faqAnswer = await this.searchFAQs(message, conversationHistory);
        if (faqAnswer) {
          const aiResponse = await this.aiService.generateFriendlyResponse(message, faqAnswer, conversationHistory);
          response = aiResponse.response;
          confidence = aiResponse.confidence;
          source = 'faq';
          
          if (confidence < 0.7) {
            requiresEscalation = true;
            escalationReason = 'Low confidence in FAQ response';
          }
          
          this.logger.info('Answer found in FAQs', { confidence });
        }
      }

      // 5. If still no answer, use AI fallback
      if (!response) {
        const context = {
          guestId,
          reservationId,
          listingMapId,
          detectedField
        };
        const fallbackResponse = await this.aiService.generateFallbackResponse(message, conversationHistory, context);
        response = fallbackResponse.response;
        confidence = fallbackResponse.confidence;
        source = 'fallback';
        requiresEscalation = true;
        escalationReason = 'No answer found in knowledge base';
        
        this.logger.warn('Using AI fallback response', { 
          guestId, 
          detectedField,
          confidence 
        });
        
        // Notify support for fallback responses
        await this.notifySupport({
          guestId,
          reservationId,
          listingMapId,
          question: message,
          response,
          reason: escalationReason
        });
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Response generated', {
        source,
        processingTime,
        responseLength: response.length,
        requiresEscalation,
        confidence
      });

      return {
        response,
        source,
        detectedField,
        processingTime,
        confidence,
        requiresEscalation,
        escalationReason
      };

    } catch (error) {
      this.logger.error('Error generating response', {
        error: error.message,
        guestId,
        messagePreview: message.substring(0, 50)
      });
      
      // Return a safe fallback response with escalation
      const errorResponse = {
        response: 'Disculpa, estoy experimentando dificultades técnicas. Un miembro de nuestro equipo te contactará pronto para ayudarte.',
        source: 'error',
        detectedField: null,
        processingTime: Date.now() - startTime,
        confidence: 0,
        requiresEscalation: true,
        escalationReason: `Technical error: ${error.message}`
      };

      // Notify support about the error
      await this.notifySupport({
        guestId,
        reservationId,
        listingMapId,
        question: message,
        response: errorResponse.response,
        reason: errorResponse.escalationReason,
        error: error.message
      });

      return errorResponse;
    }
  }

  findAnswerInListing(listing, detectedField, userQuestion) {
    if (!listing || !detectedField || !userQuestion) {
      return null;
    }

    const fieldMappings = {
      'checkintime': listing.checkInTime || null,
      'checkouttime': listing.checkOutTime || null,
      'wifi': listing.wifiUsername || null,
      'wifipassword': listing.wifiPassword || null,
      'address': listing.address || null,
      'doorcode': listing.doorCode || null,
      'contact': listing.contactPhone || null,
      'rules': listing.houseRules || null,
      'instructions': listing.specialInstructions || null
    };

    // Try exact field match first
    const normalizedField = detectedField.toLowerCase().replace(/[^a-z]/g, '');
    if (fieldMappings[normalizedField]) {
      return fieldMappings[normalizedField];
    }

    // Try partial matches
    for (const [key, value] of Object.entries(fieldMappings)) {
      if (normalizedField.includes(key) || key.includes(normalizedField)) {
        return value;
      }
    }

    // Try keyword matching in question
    const questionLower = userQuestion.toLowerCase();
    if (questionLower.includes('wifi') || questionLower.includes('internet')) {
      return `WiFi: ${listing.wifiUsername}, Password: ${listing.wifiPassword}`;
    }
    
    if (questionLower.includes('check') && questionLower.includes('in')) {
      return listing.checkInTime;
    }
    
    if (questionLower.includes('check') && questionLower.includes('out')) {
      return listing.checkOutTime;
    }

    return null;
  }

  async searchFAQs(question, conversationHistory = []) {
    try {
      if (!question) {
        this.logger.warn('Empty question provided to searchFAQs');
        return null;
      }

      const faqs = await this.faqRepository.findAll();
      
      if (!faqs || faqs.length === 0) {
        this.logger.info('No FAQs found in repository');
        return null;
      }

      // Use AI to find the most relevant FAQ
      const contextualQuestion = conversationHistory.length > 0 
        ? `Contexto previo:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: ${question}`
        : question;

      const faqsText = faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n');
      
      return await this.aiService.searchFAQs(contextualQuestion, faqsText);
      
    } catch (error) {
      this.logger.error('Error searching FAQs', { error: error.message });
      return null;
    }
  }

  calculateConfidence(source) {
    const confidenceMap = {
      'listing': 0.9,
      'faq': 0.8,
      'fallback': 0.3,
      'error': 0.1
    };
    
    return confidenceMap[source] || 0.5;
  }

  async notifySupport(notificationData) {
    try {
      // This would integrate with SendNotificationUseCase
      this.logger.info('Support notification would be sent', notificationData);
    } catch (error) {
      this.logger.error('Failed to notify support', { error: error.message });
    }
  }
}

module.exports = { GenerateResponseUseCase };