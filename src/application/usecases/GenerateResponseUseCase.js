// src/application/usecases/GenerateResponseUseCase.js
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class GenerateResponseUseCase {
  constructor({
    listingRepository,
    faqRepository,
    conversationRepository,
    aiService
  }) {
    this.listingRepository = listingRepository;
    this.faqRepository = faqRepository;
    this.conversationRepository = conversationRepository;
    this.aiService = aiService;
    this.logger = new SecureLogger();
  }

  async execute({ message, listingMapId, guestId, reservationId, context = null }) {
    const startTime = Date.now();
    
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

      if (listingMapId) {
        const listing = await this.listingRepository.findByMapId(listingMapId);
        if (listing) {
          const listingAnswer = this.findAnswerInListing(listing, detectedField, message);
          if (listingAnswer) {
            response = await this.aiService.generateFriendlyResponse(message, listingAnswer, conversationHistory);
            source = 'listing';
            
            this.logger.info('Answer found in listing data', { 
              field: detectedField,
              listingId: listing.id 
            });
          }
        }
      }

      // 4. If not found in listing, search FAQs
      if (!response) {
        const faqAnswer = await this.searchFAQs(message, conversationHistory);
        if (faqAnswer) {
          response = await this.aiService.generateFriendlyResponse(message, faqAnswer, conversationHistory);
          source = 'faq';
          
          this.logger.info('Answer found in FAQs');
        }
      }

      // 5. If still no answer, use AI fallback
      if (!response) {
        response = await this.aiService.generateFallbackResponse(message, conversationHistory, context);
        source = 'fallback';
        
        this.logger.warn('Using AI fallback response', { guestId, detectedField });
        
        // Notify support for fallback responses
        await this.notifySupport({
          guestId,
          reservationId,
          listingMapId,
          question: message,
          response,
          reason: 'No answer found in knowledge base'
        });
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Response generated', {
        source,
        processingTime,
        responseLength: response.length
      });

      return {
        response,
        source,
        detectedField,
        processingTime,
        confidence: this.calculateConfidence(source)
      };

    } catch (error) {
      this.logger.error('Error generating response', {
        error: error.message,
        guestId,
        messagePreview: message.substring(0, 50)
      });
      
      // Return a safe fallback response
      return {
        response: 'Disculpa, estoy experimentando dificultades técnicas. Un miembro de nuestro equipo te contactará pronto para ayudarte.',
        source: 'error',
        detectedField: null,
        processingTime: Date.now() - startTime,
        confidence: 0
      };
    }
  }

  findAnswerInListing(listing, detectedField, userQuestion) {
    const fieldMappings = {
      'checkintime': listing.checkInTime,
      'checkouttime': listing.checkOutTime,
      'wifi': listing.wifiUsername,
      'wifipassword': listing.wifiPassword,
      'address': listing.address,
      'doorcode': listing.doorCode,
      'contact': listing.contactPhone,
      'rules': listing.houseRules,
      'instructions': listing.specialInstructions
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

  async searchFAQs(question, conversationHistory) {
    try {
      const faqs = await this.faqRepository.findAll();
      
      if (!faqs || faqs.length === 0) {
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