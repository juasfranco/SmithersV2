/**
 * Script para probar diferentes métodos de envío de mensajes por Hostaway
 * Este script ayuda a identificar qué endpoint funciona correctamente
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Simulamos el cliente de Hostaway
class HostawayTestClient {
  constructor() {
    this.baseURL = 'https://api.hostaway.com/v1';
    this.token = null;
  }

  async initialize() {
    if (this.token) return;

    console.log('🔑 Obteniendo token de Hostaway...');
    
    try {
      const response = await fetch(`${this.baseURL}/accessTokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: process.env.HOSTAWAY_CLIENT_ID,
          client_secret: process.env.HOSTAWAY_CLIENT_SECRET,
          scope: 'general'
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        this.token = data.result.access_token;
        console.log('✅ Token obtenido exitosamente');
      } else {
        throw new Error('Failed to get token');
      }
    } catch (error) {
      console.error('❌ Error obteniendo token:', error.message);
      throw error;
    }
  }

  async request(method, endpoint, data = null) {
    if (!this.token) await this.initialize();

    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    console.log(`📡 ${method} ${endpoint}`);
    if (data) {
      console.log('📤 Payload:', JSON.stringify(data, null, 2));
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.text();
      
      console.log(`📥 Status: ${response.status} ${response.statusText}`);
      
      if (responseData) {
        try {
          const jsonData = JSON.parse(responseData);
          console.log('📥 Response:', JSON.stringify(jsonData, null, 2));
          return jsonData;
        } catch {
          console.log('📥 Response (text):', responseData);
          return responseData;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return null;
    } catch (error) {
      console.error(`❌ Request failed: ${error.message}`);
      throw error;
    }
  }
}

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

  const client = new HostawayTestClient();

  // Test 1: Probar si la reservación existe
  console.log('\n🔍 Test 1: Verificar existencia de la reservación');
  console.log('-'.repeat(50));
  try {
    await client.request('GET', `/reservations/${testData.reservationId}`);
  } catch (error) {
    console.log('⚠️  Posible problema: La reservación no existe o no es accesible');
  }

  // Test 2: Probar si la conversación existe
  console.log('\n🔍 Test 2: Verificar existencia de la conversación');
  console.log('-'.repeat(50));
  try {
    await client.request('GET', `/conversations/${testData.conversationId}`);
  } catch (error) {
    console.log('⚠️  Posible problema: La conversación no existe o no es accesible');
  }

  // Test 3: Intentar obtener mensajes de la conversación
  console.log('\n🔍 Test 3: Obtener mensajes de la conversación');
  console.log('-'.repeat(50));
  try {
    await client.request('GET', `/conversations/${testData.conversationId}/messages`);
  } catch (error) {
    console.log('⚠️  No se pudieron obtener mensajes de la conversación');
  }

  // Test 4: Método actual que está fallando - Endpoint de reservaciones
  console.log('\n🧪 Test 4: Método actual (que falla) - /reservations/{id}/messages');
  console.log('-'.repeat(50));
  try {
    await client.request('POST', `/reservations/${testData.reservationId}/messages`, {
      message: testData.testMessage,
      type: 'host_to_guest'
    });
    console.log('✅ ¡Método de reservaciones funcionó!');
  } catch (error) {
    console.log('❌ Método de reservaciones falló (como esperábamos)');
  }

  // Test 5: Método alternativo - Endpoint de conversaciones
  console.log('\n🧪 Test 5: Método alternativo - /conversations/{id}/messages');
  console.log('-'.repeat(50));
  try {
    await client.request('POST', `/conversations/${testData.conversationId}/messages`, {
      body: testData.testMessage,
      type: 'host'
    });
    console.log('✅ ¡Método de conversaciones funcionó!');
  } catch (error) {
    console.log('❌ Método de conversaciones también falló');
  }

  // Test 6: Método alternativo con diferente payload
  console.log('\n🧪 Test 6: Conversaciones con payload alternativo');
  console.log('-'.repeat(50));
  try {
    await client.request('POST', `/conversations/${testData.conversationId}/messages`, {
      message: testData.testMessage,
      isIncoming: 0,
      communicationType: 'email'
    });
    console.log('✅ ¡Payload alternativo funcionó!');
  } catch (error) {
    console.log('❌ Payload alternativo también falló');
  }

  // Test 7: Intentar envío directo por listingMapId
  console.log('\n🧪 Test 7: Envío por listing - /listings/{id}/messages');
  console.log('-'.repeat(50));
  try {
    await client.request('POST', `/listings/${testData.listingMapId}/messages`, {
      body: testData.testMessage,
      reservationId: testData.reservationId,
      communicationType: 'email'
    });
    console.log('✅ ¡Método de listings funcionó!');
  } catch (error) {
    console.log('❌ Método de listings también falló');
  }

  // Test 8: Explorar otros endpoints disponibles
  console.log('\n🔍 Test 8: Explorar otros endpoints disponibles');
  console.log('-'.repeat(50));
  try {
    // Intentar obtener información de la cuenta
    const accountInfo = await client.request('GET', '/users/me');
    console.log('✅ Conexión con API verificada exitosamente');
  } catch (error) {
    console.log('❌ Problema con la conexión API general');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Pruebas completadas');
  console.log('='.repeat(60));
  
  console.log('\n📋 RECOMENDACIONES:');
  console.log('1. Si algún método funcionó, actualizar HostawayService.js');
  console.log('2. Si todos fallaron, verificar permisos de API y configuración');
  console.log('3. Revisar documentación oficial de Hostaway API');
  console.log('4. Considerar contactar soporte técnico de Hostaway');
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  testHostawayMessageSending().catch(error => {
    console.error('💥 Error en las pruebas:', error);
    process.exit(1);
  });
}

module.exports = { testHostawayMessageSending };