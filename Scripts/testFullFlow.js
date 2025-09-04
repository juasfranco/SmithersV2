// Scripts/testFullFlow.js
require('dotenv').config();
const { DependencyContainer } = require('../src/config/DependencyContainer');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');

const logger = new SecureLogger();

// Datos de ejemplo para simular webhooks de Hostaway
const mockWebhooks = {
  // 1. Nueva reservación
  newReservation: {
    event: 'reservation_created',
    data: {
      reservationId: '123456',
      guestId: 'G789',
      listingMapId: 'L101',
      checkInDate: '2025-10-01',
      checkOutDate: '2025-10-05',
      guestName: 'Juan Pérez',
      guestEmail: 'juan@example.com',
      status: 'confirmed'
    }
  },

  // 2. Mensajes de prueba del huésped
  newMessages: [
    {
      event: 'conversation_message_created',
      data: {
        messageId: 'M123',
        conversationId: 'C456',
        guestId: 'G789',
        reservationId: '123456',
        listingMapId: 'L101',
        message: '¿Cuál es el código WiFi?',
        direction: 'guest_to_host',
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'conversation_message_created',
      data: {
        messageId: 'M124',
        conversationId: 'C456',
        guestId: 'G789',
        reservationId: '123456',
        listingMapId: 'L101',
        message: '¿A qué hora es el check-in?',
        direction: 'guest_to_host',
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'conversation_message_created',
      data: {
        messageId: 'M125',
        conversationId: 'C456',
        guestId: 'G789',
        reservationId: '123456',
        listingMapId: 'L101',
        message: '¿Hay restaurantes cerca del apartamento?',
        direction: 'guest_to_host',
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'conversation_message_created',
      data: {
        messageId: 'M126',
        conversationId: 'C456',
        guestId: 'G789',
        reservationId: '123456',
        listingMapId: 'L101',
        message: '¿Cuál es el código de la puerta?',
        direction: 'guest_to_host',
        timestamp: new Date().toISOString()
      }
    }
  ],

  // 3. Actualización de reserva
  reservationUpdate: {
    event: 'reservation_updated',
    data: {
      reservationId: '123456',
      guestId: 'G789',
      listingMapId: 'L101',
      updateType: 'dates_changed',
      oldData: {
        checkInDate: '2025-10-01',
        checkOutDate: '2025-10-05'
      },
      newData: {
        checkInDate: '2025-10-02',
        checkOutDate: '2025-10-06'
      }
    }
  }
};

async function simulateWebhook(container, webhookData) {
  try {
    logger.info('🔄 Simulando webhook', {
      event: webhookData.event
    });

    // Obtener el controlador
    const webhookController = container.get('webhookController');

    // Crear request simulado
    const req = {
      body: webhookData,
      container: container
    };

    // Crear response simulado
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };

    // Procesar webhook
    await webhookController.handleHostawayWebhook(req, res);

    logger.info('✅ Webhook procesado exitosamente', {
      event: webhookData.event,
      status: res.statusCode,
      response: res.data
    });

    return res;

  } catch (error) {
    logger.error('❌ Error procesando webhook', {
      event: webhookData.event,
      error: error.message
    });
    throw error;
  }
}

async function testFullFlow() {
  try {
    logger.info('🚀 Iniciando prueba de flujo completo...');

    // 1. Inicializar container
    const container = new DependencyContainer();
    await container.initialize();

    // 2. Verificar conexión con Hostaway
    const hostawayService = container.get('hostawayService');
    const connected = await hostawayService.testConnection();
    
    if (!connected) {
      throw new Error('No se pudo conectar con Hostaway');
    }
    
    logger.info('✅ Conexión con Hostaway establecida');

    // 3. Simular flujo completo
    logger.info('\n📝 PASO 1: Simulando nueva reservación...');
    await simulateWebhook(container, mockWebhooks.newReservation);
    
    // Esperar un momento para que se procese
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info('\n💬 PASO 2: Simulando mensajes del huésped...');
    
    // Procesar cada mensaje secuencialmente
    for (const message of mockWebhooks.newMessages) {
      logger.info(`\nProcesando mensaje: "${message.data.message}"`);
      const messageResponse = await simulateWebhook(container, message);
      
      // Esperar un momento para que se procese
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mostrar la respuesta
      if (messageResponse.data && messageResponse.data.success) {
        logger.info('✅ Mensaje procesado exitosamente');
      } else {
        logger.warn('⚠️ Mensaje puede requerir atención', messageResponse.data);
      }
    }

    logger.info('\n🔄 PASO 3: Simulando actualización de reserva...');
    await simulateWebhook(container, mockWebhooks.reservationUpdate);

    // 4. Verificar estado final
    const conversation = await container
      .get('conversationRepository')
      .findByGuestId(mockWebhooks.newMessage.data.guestId);

    logger.info('\n📊 Resumen de la conversación:', {
      guestId: conversation?.guestId,
      messageCount: conversation?.messages?.length || 0,
      lastMessage: conversation?.messages?.[conversation.messages.length - 1]
    });

    logger.info('✅ Prueba de flujo completo finalizada exitosamente');

  } catch (error) {
    logger.error('❌ Error en la prueba', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Ejecutar prueba
if (require.main === module) {
  testFullFlow().catch(error => {
    console.error('💥 Error ejecutando prueba:', error);
    process.exit(1);
  });
}

module.exports = { testFullFlow, simulateWebhook };
