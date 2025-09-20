// src/application/usecases/GenerateResponseUseCase.js - Con import correcto
const { SecureLogger } = require('../../shared/logger/SecureLogger');

class GenerateResponseUseCase {
  constructor({
    listingRepository,
    faqRepository,
    conversationRepository,
    aiService,
    hostawayService
  }) {
    // Validate required dependencies
    if (!listingRepository || !faqRepository || !conversationRepository || !aiService || !hostawayService) {
      throw new Error('Missing required dependencies in GenerateResponseUseCase');
    }

    // Validate repository interfaces
    if (typeof listingRepository.findByMapId !== 'function' ||
        typeof faqRepository.findAll !== 'function' ||
        typeof conversationRepository.findByGuestId !== 'function' ||
        typeof aiService.detectField !== 'function' ||
        typeof hostawayService.sendMessage !== 'function') {
      throw new Error('Invalid repository or service implementation');
    }

    this.listingRepository = listingRepository;
    this.faqRepository = faqRepository;
    this.conversationRepository = conversationRepository;
    this.aiService = aiService;
    this.hostawayService = hostawayService;
    this.logger = new SecureLogger();
  }

  async execute({ guestId, reservationId, conversationId, listingMapId, message }) {
    const startTime = Date.now();
    let response = null;
    let source = 'unknown';
    let confidence = 0;
    let requiresEscalation = false; 
    let escalationReason = null;
    
    // Validate input parameters
    if (!guestId || !reservationId || !message) {
      throw new Error('Missing required parameters');
    }

    try {
      this.logger.debug('Starting response generation process', { 
        guestId, 
        listingMapId,
        messagePreview: message.substring(0, 50) 
      });

      // PASO 1: Obtener historial de conversación para contexto
      this.logger.debug('Step 1: Getting conversation history');
      const conversation = await this.conversationRepository.findByGuestId(guestId);
      const conversationHistory = conversation ? conversation.getRecentMessages(5) : [];
      
      this.logger.debug('Conversation history retrieved', {
        historyLength: conversationHistory.length
      });

      // PASO 2: Detectar el campo/tema de la pregunta usando AI
      this.logger.debug('Step 2: Detecting question topic using AI');
      const detectedField = await this.aiService.detectField({
        message,
        context: conversationHistory,
        fields: ['checkInTime', 'checkOutTime', 'wifi', 'parking', 'address', 'breakfast', 'pets', 'smoking', 'amenities']
      });
      
      this.logger.debug('Field detected by AI', { 
        detectedField,
        confidence: confidence 
      });

      // PASO 3: Buscar respuesta en datos del listing
      // PASO 3: Buscar respuesta en datos del listing
      this.logger.debug('Step 3: Searching in listing data');
      if (listingMapId) {
        try {
          const listing = await this.listingRepository.findByMapId(listingMapId);
          if (listing) {
            const listingAnswer = this.findAnswerInListing(listing, detectedField, message);
            if (listingAnswer) {
              // Genera una respuesta amigable basada en los datos del listing
              const aiResponse = await this.aiService.generateFriendlyResponse(
                message, 
                listingAnswer.answer,
                conversationHistory
              );

              response = aiResponse.response;
              confidence = listingAnswer.confidence * aiResponse.confidence;
              source = listingAnswer.source;
              
              if (confidence < 0.7) {
                requiresEscalation = true;
                escalationReason = 'Low confidence in listing data response';
              }
              
              this.logger.info('Answer found in listing data', { 
                field: detectedField,
                listingId: listing.id,
                confidence,
                source: listingAnswer.source
              });
            } else {
              this.logger.debug('No matching information found in listing data');
            }
          }
        } catch (error) {
          this.logger.error('Error accessing listing data', {
            error: error.message,
            listingMapId
          });
        }
      }

      // PASO 4: Si no encuentra en listing, buscar en FAQs
      if (!response) {
        this.logger.debug('Step 4: Searching in FAQs');
        try {
          const faqAnswer = await this.searchFAQs(message, conversationHistory);
          if (faqAnswer) {
            const aiResponse = await this.aiService.generateFriendlyResponse(
              message, 
              faqAnswer, 
              conversationHistory
            );
            
            response = aiResponse.response;
            confidence = aiResponse.confidence;
            source = 'faq';
            
            if (confidence < 0.7) {
              requiresEscalation = true;
              escalationReason = 'Low confidence in FAQ response';
            }
            
            this.logger.info('Answer found in FAQs', { 
              confidence,
              source: 'faq'
            });
          } else {
            this.logger.debug('No matching FAQ found');
          }
        } catch (error) {
          this.logger.error('Error searching FAQs', {
            error: error.message
          });
        }
      }

      // PASO 5: Si aún no hay respuesta, usar AI como fallback
      if (!response) {
        this.logger.debug('Step 5: Using AI fallback');
        try {
          // Preparar contexto enriquecido para el AI
          const context = {
            guestId,
            reservationId,
            listingMapId,
            detectedField,
            conversationHistory: conversationHistory.length,
            attemptedSources: ['listing', 'faq']
          };

          // Generar respuesta usando AI como último recurso
          const fallbackResponse = await this.aiService.generateFallbackResponse(
            message, 
            conversationHistory, 
            context
          );

          response = fallbackResponse.response;
          confidence = fallbackResponse.confidence;
          source = 'ai-fallback';
          requiresEscalation = true;
          escalationReason = 'No answer found in knowledge bases (listing/FAQ)';
          
          // Safety check for undefined response
          if (!response || typeof response !== 'string') {
            response = 'Disculpa, estoy experimentando dificultades técnicas. Un miembro de nuestro equipo te contactará pronto para ayudarte.';
            source = 'technical-fallback';
            requiresEscalation = true;
            escalationReason = 'AI service returned invalid response';
          }
          
          this.logger.warn('Using AI fallback response', { 
            guestId, 
            detectedField,
            confidence,
            responseValid: !!response,
            source
          });
          
          // Notificar a soporte cuando se usa fallback
          await this.notifySupport({
            guestId,
            reservationId,
            listingMapId,
            question: message,
            response,
            reason: escalationReason,
            detectedField,
            confidence
          });
        } catch (error) {
          this.logger.error('Error generating AI fallback response', {
            error: error.message
          });
          throw error; // Let the error handler create the final fallback response
        }
      }

      // Final safety check
      if (!response || typeof response !== 'string') {
        response = 'Disculpa, estoy experimentando dificultades técnicas. Un miembro de nuestro equipo te contactará pronto para ayudarte.';
        source = 'emergency-fallback';
        requiresEscalation = true;
        escalationReason = 'No valid response generated';
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info('Response generated', {
        source,
        processingTime,
        responseLength: response ? response.length : 0,
        requiresEscalation,
        confidence
      });

      // Enviar la respuesta a través de Hostaway
      try {
        const sentMessage = await this.hostawayService.sendMessageToGuest(
          reservationId, 
          response,
          conversationId
        );

        this.logger.info('Response sent via Hostaway', {
          messageId: sentMessage.id,
          reservationId,
          source
        });

        // La conversación se guarda automáticamente en ProcessWebhookUseCase
        // No es necesario guardarla aquí también

        return {
          response,
          source,
          detectedField,
          processingTime,
          confidence,
          requiresEscalation,
          escalationReason,
          messageId: sentMessage.id,
          sent: true
        };

      } catch (error) {
        this.logger.error('Failed to send message via Hostaway', {
          error: error.message,
          reservationId
        });

        return {
          response,
          source,
          detectedField,
          processingTime,
          confidence,
          requiresEscalation,
          escalationReason,
          sent: false,
          error: 'Failed to send message via Hostaway'
        };
      }

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

    // Estructura jerárquica de campos y sus aliases
    const fieldHierarchy = {
      checkIn: {
        priority: 1,
        fields: ['checkInTime', 'checkInInstructions'],
        aliases: ['check in', 'checkin', 'arrival', 'llegada', 'entrada'],
        getValue: () => ({
          value: `Check-in time: ${listing.checkInTime}\nInstructions: ${listing.checkInInstructions || 'No special instructions'}`,
          confidence: 0.9
        })
      },
      checkOut: {
        priority: 1,
        fields: ['checkOutTime', 'checkOutInstructions'],
        aliases: ['check out', 'checkout', 'departure', 'salida'],
        getValue: () => ({
          value: `Check-out time: ${listing.checkOutTime}\nInstructions: ${listing.checkOutInstructions || 'No special instructions'}`,
          confidence: 0.9
        })
      },
      wifi: {
        priority: 2,
        fields: ['wifiUsername', 'wifiPassword'],
        aliases: ['wifi', 'internet', 'connection', 'network'],
        getValue: () => ({
          value: `WiFi Network: ${listing.wifiUsername}\nPassword: ${listing.wifiPassword}`,
          confidence: 0.95
        })
      },
      access: {
        priority: 1,
        fields: ['doorCode', 'accessInstructions'],
        aliases: ['door', 'code', 'access', 'entry', 'acceso', 'puerta', 'código'],
        getValue: () => ({
          value: `Door code: ${listing.doorCode}\n${listing.accessInstructions || ''}`,
          confidence: 0.9
        })
      },
      location: {
        priority: 2,
        fields: ['address', 'directions'],
        aliases: ['address', 'location', 'dirección', 'ubicación'],
        getValue: () => ({
          value: `Address: ${listing.address}\n${listing.directions || ''}`,
          confidence: 0.9
        })
      },
      rules: {
        priority: 3,
        fields: ['houseRules'],
        aliases: ['rules', 'regulations', 'reglas', 'normas'],
        getValue: () => ({
          value: listing.houseRules || 'No specific house rules provided.',
          confidence: 0.85
        })
      },
      amenities: {
        priority: 4,
        fields: ['amenities'],
        aliases: ['amenities', 'facilities', 'servicios'],
        getValue: () => ({
          value: listing.amenities ? JSON.stringify(listing.amenities, null, 2) : 'No amenities information available.',
          confidence: 0.8
        })
      },
      contact: {
        priority: 1,
        fields: ['contactPhone', 'emergencyContact'],
        aliases: ['contact', 'phone', 'emergency', 'contacto', 'teléfono', 'emergencia'],
        getValue: () => ({
          value: `Contact Phone: ${listing.contactPhone}\nEmergency: ${listing.emergencyContact || listing.contactPhone}`,
          confidence: 0.95
        })
      }
    };

    const normalizedQuestion = userQuestion.toLowerCase();
    const normalizedField = detectedField.toLowerCase();

    // 1. Búsqueda por campo detectado por AI
    for (const [category, config] of Object.entries(fieldHierarchy)) {
      if (config.fields.some(field => normalizedField.includes(field.toLowerCase())) ||
          config.aliases.some(alias => normalizedField.includes(alias.toLowerCase()))) {
        const result = config.getValue();
        if (result.value) {
          return {
            answer: result.value,
            confidence: result.confidence,
            source: 'listing-direct'
          };
        }
      }
    }

    // 2. Búsqueda por palabras clave en la pregunta
    for (const [category, config] of Object.entries(fieldHierarchy)) {
      if (config.aliases.some(alias => normalizedQuestion.includes(alias.toLowerCase()))) {
        const result = config.getValue();
        if (result.value) {
          return {
            answer: result.value,
            confidence: result.confidence * 0.9, // Slightly lower confidence for keyword matching
            source: 'listing-keyword'
          };
        }
      }
    }

    // 3. Búsqueda en campos especiales o instrucciones generales
    if (listing.specialInstructions && 
        (normalizedQuestion.includes('instruction') || 
         normalizedQuestion.includes('help') || 
         normalizedQuestion.includes('how to'))) {
      return {
        answer: listing.specialInstructions,
        confidence: 0.7,
        source: 'listing-special'
      };
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