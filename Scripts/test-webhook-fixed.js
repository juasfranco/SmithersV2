/**
 * Script para probar el fix del envío de mensajes con el webhook problemático
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { DependencyContainer } = require('../src/config/DependencyContainer');
const { WebhookDto } = require('../src/application/dto/WebhookDto');

async function testWebhookFix() {
  console.log('🧪 Probando fix del webhook con datos reales');
  console.log('='.repeat(60));

  try {
    // Inicializar el contenedor de dependencias
    console.log('🔧 Inicializando servicios...');
    const container = new DependencyContainer();
    await container.initialize();
    
    const processWebhookUseCase = container.get('processWebhookUseCase');
    console.log('✅ Servicios inicializados correctamente');

    // Datos del webhook problemático (del log que proporcionaste)
    const problematicWebhookData = {
      "id": 324503549,
      "accountId": 90044,
      "userId": null,
      "listingMapId": 234202,
      "reservationId": 47773548,
      "conversationId": 34132494,
      "communicationId": null,
      "airbnbThreadMessageId": null,
      "channelId": null,
      "channelThreadMessageId": null,
      "body": "me podrias decir el check out time , por favor",
      "imagesUrls": null,
      "bookingcomSubthreadId": null,
      "inReplyTo": null,
      "bookingcomReplyOptions": null,
      "bookingcomSelectedOptions": null,
      "isIncoming": 1,
      "isSeen": 0,
      "sentUsingHostaway": 0,
      "hash": "8357197c4b1abc3b5ed0ea8b7a557044",
      "listingTimeZoneName": "Europe/Berlin",
      "communicationEvent": null,
      "communicationTimeDelta": null,
      "communicationTimeDeltaSeconds": 0,
      "communicationApplyListingTimeZone": null,
      "communicationAlwaysTrigger": null,
      "date": "2025-09-18 21:08:09",
      "status": "sent",
      "sentChannelDate": null,
      "listingName": "Flat in the middle of Kreuzberg for 13",
      "attachments": [],
      "insertedOn": "2025-09-18 21:08:09",
      "updatedOn": "2025-09-18 21:08:09",
      "communicationType": "email"
    };

    console.log('\n📥 Procesando webhook con datos problemáticos...');
    console.log('   Reservación ID:', problematicWebhookData.reservationId);
    console.log('   Conversación ID:', problematicWebhookData.conversationId);
    console.log('   Mensaje:', problematicWebhookData.body);

    // Convertir usando WebhookDto
    const webhookDto = new WebhookDto(problematicWebhookData);
    const extractedData = webhookDto.extract();
    
    console.log('\n📊 Datos extraídos del webhook:');
    console.log('   Evento:', extractedData.event);
    console.log('   Reservación ID:', extractedData.reservationId);
    console.log('   Conversación ID:', extractedData.conversationId);
    console.log('   Mensaje:', extractedData.message);

    // Procesar el webhook
    console.log('\n🚀 Ejecutando ProcessWebhookUseCase...');
    const result = await processWebhookUseCase.execute(extractedData);

    console.log('\n✅ Resultado del procesamiento:');
    console.log('   Éxito:', result.success);
    console.log('   Tiempo de procesamiento:', result.processingTime, 'ms');
    if (result.message) {
      console.log('   Mensaje:', result.message);
    }

  } catch (error) {
    console.error('\n💥 Error durante la prueba:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    // Verificar si es el error específico que estamos arreglando
    if (error.message.includes('HTTP 404')) {
      console.log('\n🔍 ANÁLISIS DEL ERROR:');
      console.log('   - Si el error sigue siendo "HTTP 404: Resource not found"');
      console.log('   - Puede indicar que aún hay problemas con los endpoints');
      console.log('   - O que las credenciales no tienen los permisos correctos');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Prueba completada');
  console.log('='.repeat(60));
}

// Ejecutar prueba
if (require.main === module) {
  testWebhookFix().catch(error => {
    console.error('💥 Error en la prueba:', error);
    process.exit(1);
  });
}

module.exports = { testWebhookFix };