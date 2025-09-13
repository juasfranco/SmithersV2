// Scripts/testConversation.js
require('dotenv').config();
const { GenerateResponseUseCase } = require('../src/application/usecases/GenerateResponseUseCase');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');

class MockRepository {
  constructor(mockData) {
    this.mockData = mockData;
  }
}

class MockListingRepository extends MockRepository {
  async findByMapId(mapId) {
    return this.mockData[mapId] || null;
  }
}

class MockFAQRepository extends MockRepository {
  async findAll() {
    return this.mockData;
  }
}

class MockConversationRepository extends MockRepository {
  async findByGuestId(guestId) {
    const conversation = this.mockData[guestId];
    return {
      getRecentMessages: (count) => conversation?.slice(-count) || []
    };
  }
}

class MockAIService {
  async detectField(message, history) {
    // Simula detección de campo basado en palabras clave
    const fieldMap = {
      'wifi': 'wifi',
      'internet': 'wifi',
      'password': 'wifi',
      'check': 'checkInTime',
      'llegada': 'checkInTime',
      'salida': 'checkOutTime',
      'door': 'access',
      'código': 'access',
      'reglas': 'rules',
      'contact': 'contact'
    };

    const words = message.toLowerCase().split(' ');
    for (const word of words) {
      if (fieldMap[word]) return fieldMap[word];
    }
    return 'general';
  }

  async generateFriendlyResponse(message, answer, history) {
    return {
      response: `Respuesta amigable: ${answer}`,
      confidence: 0.9
    };
  }

  async searchFAQs(question, faqsText) {
    // Simula búsqueda en FAQs
    return "Respuesta encontrada en FAQs";
  }

  async generateFallbackResponse(message, history, context) {
    return {
      response: "Lo siento, no tengo una respuesta específica para eso. ¿Podrías reformular tu pregunta?",
      confidence: 0.5
    };
  }
}

// Datos de prueba
const mockListing = {
  "123": {
    id: "123",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    checkInInstructions: "Dirígete a la recepción",
    wifiUsername: "Guest_WiFi",
    wifiPassword: "welcome2023",
    doorCode: "1234#",
    accessInstructions: "Usa el código en el teclado numérico",
    address: "Calle Principal 123",
    contactPhone: "+1234567890",
    houseRules: "No fiestas, no mascotas",
    specialInstructions: "El control de la TV está en el cajón"
  }
};

const mockFAQs = [
  {
    question: "¿Dónde puedo estacionar?",
    answer: "Hay estacionamiento gratuito en la calle"
  },
  {
    question: "¿Hay supermercados cerca?",
    answer: "Sí, hay un supermercado a 2 cuadras"
  }
];

const mockConversations = {
  "guest1": [
    { role: "user", content: "Hola, ¿cómo accedo al apartamento?" },
    { role: "assistant", content: "El código de acceso es 1234#" }
  ]
};

async function runTest() {
  const logger = new SecureLogger();
  
  // Crear instancias mock
  const useCase = new GenerateResponseUseCase({
    listingRepository: new MockListingRepository(mockListing),
    faqRepository: new MockFAQRepository(mockFAQs),
    conversationRepository: new MockConversationRepository(mockConversations),
    aiService: new MockAIService()
  });

  // Array de pruebas
  const tests = [
    {
      name: "Pregunta sobre WiFi",
      input: {
        guestId: "guest1",
        reservationId: "res1",
        listingMapId: "123",
        message: "¿Cuál es el wifi?"
      }
    },
    {
      name: "Pregunta sobre check-in",
      input: {
        guestId: "guest1",
        reservationId: "res1",
        listingMapId: "123",
        message: "¿A qué hora puedo hacer check in?"
      }
    },
    {
      name: "Pregunta sobre estacionamiento (FAQ)",
      input: {
        guestId: "guest1",
        reservationId: "res1",
        listingMapId: "123",
        message: "¿Dónde puedo estacionar mi auto?"
      }
    },
    {
      name: "Pregunta sin respuesta directa",
      input: {
        guestId: "guest1",
        reservationId: "res1",
        listingMapId: "123",
        message: "¿Qué restaurantes recomiendan en la zona?"
      }
    }
  ];

  // Ejecutar pruebas
  for (const test of tests) {
    console.log(`\n🧪 Ejecutando prueba: ${test.name}`);
    console.log("Entrada:", test.input.message);
    
    try {
      const result = await useCase.execute(test.input);
      console.log("✅ Resultado:");
      console.log("- Respuesta:", result.response);
      console.log("- Fuente:", result.source);
      console.log("- Campo detectado:", result.detectedField);
      console.log("- Confianza:", result.confidence);
      console.log("- Requiere escalación:", result.requiresEscalation);
      if (result.escalationReason) {
        console.log("- Razón de escalación:", result.escalationReason);
      }
    } catch (error) {
      console.error("❌ Error en la prueba:", error.message);
    }
  }
}

// Ejecutar todas las pruebas
runTest().catch(console.error);
