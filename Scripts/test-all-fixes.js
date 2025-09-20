/**
 * Script para probar todas las correcciones implementadas
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { OpenAIService } = require('../src/infrastructure/external/openai/OpenAIService');

async function testAIServiceFix() {
  console.log('🧪 Probando correcciones del AI Service');
  console.log('='.repeat(50));

  try {
    // Inicializar el servicio de AI
    const aiService = new OpenAIService({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    // Test 1: Verificar detectField
    console.log('\n📋 Test 1: Verificar detectField...');
    const detectedField = await aiService.detectField({
      message: "me podrias decir a que horas es el checkout ?",
      fields: ['checkInTime', 'checkOutTime', 'wifi', 'parking']
    });
    console.log('   Campo detectado:', detectedField);
    console.log('   ✅ Expected: checkOutTime');

    // Test 2: Verificar generateFriendlyResponse con nuevo formato
    console.log('\n📋 Test 2: Verificar generateFriendlyResponse...');
    const friendlyResponse = await aiService.generateFriendlyResponse(
      "me podrias decir a que horas es el checkout ?",
      "11:00 AM",
      []
    );
    
    console.log('   Respuesta generada:', JSON.stringify(friendlyResponse, null, 2));
    console.log('   ✅ Expected: {response: string, confidence: number}');
    
    // Verificar formato
    if (friendlyResponse && typeof friendlyResponse.response === 'string' && typeof friendlyResponse.confidence === 'number') {
      console.log('   ✅ Formato correcto!');
    } else {
      console.log('   ❌ Formato incorrecto');
    }

  } catch (error) {
    console.error('💥 Error en las pruebas:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Pruebas completadas');
  console.log('='.repeat(50));
}

// Test directo del webhook data
function testWebhookProcessing() {
  console.log('\n🧪 Probando procesamiento del webhook...');
  
  const webhookData = {
    "body": "Hola muy buenos dias me podrias decir a que horas es el checkout ?\\n\\ngracias",
    "reservationId": 47773548,
    "conversationId": 34132494,
    "listingMapId": 234202
  };

  console.log('   Datos del webhook:');
  console.log('   - Mensaje:', webhookData.body.replace('\\n', ' '));
  console.log('   - Reservación ID:', webhookData.reservationId);
  console.log('   - Conversación ID:', webhookData.conversationId);
  console.log('   - Listing ID:', webhookData.listingMapId);

  console.log('\n   Flujo esperado:');
  console.log('   1. ✅ Detectar campo: checkOutTime');
  console.log('   2. ✅ Encontrar datos en listing');
  console.log('   3. ✅ AI genera respuesta amigable (nuevo formato)');
  console.log('   4. ✅ Envío via /conversations/34132494/messages');
  console.log('   5. ✅ Guardar en MongoDB (enum actualizado)');
}

if (require.main === module) {
  console.log('🔧 RESUMEN DE CORRECCIONES IMPLEMENTADAS');
  console.log('='.repeat(60));
  console.log('1. ✅ OpenAIService.generateFriendlyResponse() ahora retorna {response, confidence}');
  console.log('2. ✅ ConversationModel enum actualizado con "technical-fallback"');
  console.log('3. ✅ Eliminada llamada a conversationRepository.addMessage()');
  console.log('4. ✅ HostawayService usa endpoint /conversations/{id}/messages');
  console.log('='.repeat(60));

  testWebhookProcessing();
  
  testAIServiceFix().catch(error => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
}

module.exports = { testAIServiceFix };