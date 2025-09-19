/**
 * Script para probar diferentes métodos de envío de mensajes por Hostaway
 * Usando la infraestructura existente del proyecto
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Importamos los servicios existentes
const { DependencyContainer } = require('../src/config/DependencyContainer');

async function testHostawayMessageSending() {
  console.log('🧪 Iniciando pruebas de envío de mensajes por Hostaway');
  console.log('='.repeat(60));

  // Datos del webhook que estamos analizando
  const testData = {
    reservationId: 47773548,
    conversationId: 34132494,
    listingMapId: 234202,
    testMessage: 'El check-out es a las 11:00 AM. ¡Gracias por tu pregunta!'
  };

  console.log('📋 Datos de prueba:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('='.repeat(60));

  try {
    // Inicializar el contenedor de dependencias
    console.log('🔧 Inicializando servicios...');
    const container = new DependencyContainer();
    await container.initialize();
    
    const hostawayService = container.get('hostawayService');
    const hostawayClient = hostawayService.client; // El client está dentro del service
    
    console.log('✅ Servicios inicializados correctamente');

    // Test 1: Verificar que el servicio está funcionando
    console.log('\n🔍 Test 1: Verificar conexión con Hostaway');
    console.log('-'.repeat(50));
    try {
      // Probamos hacer una llamada simple para verificar conectividad
      await hostawayClient.request('GET', '/users/me');
      console.log('✅ Conexión con API de Hostaway verificada');
    } catch (error) {
      console.log('❌ Error de conexión:', error.message);
      return;
    }

    // Test 2: Verificar existencia de la reservación
    console.log('\n🔍 Test 2: Verificar existencia de la reservación');
    console.log('-'.repeat(50));
    try {
      const reservation = await hostawayClient.request('GET', `/reservations/${testData.reservationId}`);
      console.log('✅ Reservación encontrada:');
      console.log(`   - ID: ${reservation.result?.id}`);
      console.log(`   - Estado: ${reservation.result?.status}`);
      console.log(`   - Listing: ${reservation.result?.listingMapId}`);
    } catch (error) {
      console.log('❌ Reservación no encontrada:', error.message);
      if (error.message.includes('404')) {
        console.log('   ⚠️  La reservación no existe o no es accesible con tus credenciales');
      }
    }

    // Test 3: Verificar existencia de la conversación
    console.log('\n🔍 Test 3: Verificar existencia de la conversación');
    console.log('-'.repeat(50));
    try {
      const conversation = await hostawayClient.request('GET', `/conversations/${testData.conversationId}`);
      console.log('✅ Conversación encontrada:');
      console.log(`   - ID: ${conversation.result?.id}`);
      console.log(`   - Reservación: ${conversation.result?.reservationId}`);
      console.log(`   - Canal: ${conversation.result?.channelId}`);
    } catch (error) {
      console.log('❌ Conversación no encontrada:', error.message);
      if (error.message.includes('404')) {
        console.log('   ⚠️  La conversación no existe o no es accesible');
      }
    }

    // Test 4: Intentar obtener mensajes de la conversación
    console.log('\n🔍 Test 4: Obtener mensajes de la conversación');
    console.log('-'.repeat(50));
    try {
      const messages = await hostawayClient.request('GET', `/conversations/${testData.conversationId}/messages`);
      console.log('✅ Mensajes obtenidos exitosamente');
      console.log(`   - Total mensajes: ${messages.result?.length || 0}`);
      if (messages.result && messages.result.length > 0) {
        const lastMessage = messages.result[messages.result.length - 1];
        console.log(`   - Último mensaje: "${lastMessage.body?.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.log('❌ No se pudieron obtener mensajes:', error.message);
    }

    // Test 5: Método actual que está fallando - Endpoint de reservaciones
    console.log('\n🧪 Test 5: Método actual (que falla) - /reservations/{id}/messages');
    console.log('-'.repeat(50));
    try {
      const result = await hostawayClient.request('POST', `/reservations/${testData.reservationId}/messages`, {
        message: testData.testMessage,
        type: 'host_to_guest'
      });
      console.log('✅ ¡Método de reservaciones funcionó!');
      console.log('   - Resultado:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Método de reservaciones falló:', error.message);
      console.log('   - Este es el método que está causando problemas en producción');
    }

    // Test 6: Método alternativo - Endpoint de conversaciones
    console.log('\n🧪 Test 6: Método alternativo - /conversations/{id}/messages');
    console.log('-'.repeat(50));
    try {
      const result = await hostawayClient.request('POST', `/conversations/${testData.conversationId}/messages`, {
        body: testData.testMessage,
        type: 'host'
      });
      console.log('✅ ¡Método de conversaciones funcionó!');
      console.log('   - Resultado:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Método de conversaciones falló:', error.message);
    }

    // Test 7: Método alternativo con diferentes payload structures
    console.log('\n🧪 Test 7: Conversaciones con diferentes estructuras de payload');
    console.log('-'.repeat(50));
    
    const payloadVariations = [
      {
        name: 'Payload Variation 1',
        data: {
          message: testData.testMessage,
          isIncoming: 0,
          communicationType: 'email'
        }
      },
      {
        name: 'Payload Variation 2', 
        data: {
          body: testData.testMessage,
          isIncoming: 0,
          sentUsingHostaway: 1
        }
      },
      {
        name: 'Payload Variation 3',
        data: {
          body: testData.testMessage,
          communicationType: 'email',
          isIncoming: 0,
          reservationId: testData.reservationId
        }
      }
    ];

    for (const variation of payloadVariations) {
      try {
        console.log(`   Probando ${variation.name}...`);
        const result = await hostawayClient.request('POST', `/conversations/${testData.conversationId}/messages`, variation.data);
        console.log(`   ✅ ${variation.name} funcionó!`);
        console.log('      - Resultado:', JSON.stringify(result, null, 2));
        break; // Si funciona uno, no necesitamos probar los demás
      } catch (error) {
        console.log(`   ❌ ${variation.name} falló: ${error.message}`);
      }
    }

    // Test 8: Verificar listado de conversaciones para debugging
    console.log('\n🔍 Test 8: Obtener listado de conversaciones para debugging');
    console.log('-'.repeat(50));
    try {
      const conversations = await hostawayClient.request('GET', '/conversations', null, {
        limit: 5,
        reservationId: testData.reservationId
      });
      console.log('✅ Conversaciones obtenidas:');
      if (conversations.result && conversations.result.length > 0) {
        conversations.result.forEach((conv, index) => {
          console.log(`   ${index + 1}. ID: ${conv.id}, Reservación: ${conv.reservationId}, Estado: ${conv.status}`);
        });
      } else {
        console.log('   - No se encontraron conversaciones');
      }
    } catch (error) {
      console.log('❌ Error obteniendo conversaciones:', error.message);
    }

  } catch (error) {
    console.error('💥 Error general en las pruebas:', error);
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Pruebas completadas');
  console.log('='.repeat(60));
  
  console.log('\n📋 ANÁLISIS Y RECOMENDACIONES:');
  console.log('1. Verificar qué métodos funcionaron exitosamente');
  console.log('2. El endpoint /reservations/{id}/messages parece no estar disponible');
  console.log('3. Probar usar /conversations/{id}/messages en su lugar');
  console.log('4. Verificar que tengas los permisos correctos en tu API key');
  console.log('5. Actualizar HostawayService.js con el método que funcione');
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  testHostawayMessageSending().catch(error => {
    console.error('💥 Error en las pruebas:', error);
    process.exit(1);
  });
}

module.exports = { testHostawayMessageSending };