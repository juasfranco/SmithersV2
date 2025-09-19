/**
 * Script para probar el envío de mensajes usando el endpoint correcto de conversaciones
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { HostawayService } = require('../src/infrastructure/external/hostaway/HostawayService');

async function testMessageSending() {
  console.log('🧪 Probando envío de mensajes usando el endpoint correcto');
  console.log('='.repeat(60));

  const service = new HostawayService();

  try {
    await service.initialize();
    console.log('✅ Servicio inicializado correctamente');

    const testData = {
      conversationId: 34132494,
      testMessage: '🤖 Este es un mensaje de prueba del sistema automatizado. El check-out es a las 11:00 AM. ¡Gracias por tu pregunta!'
    };

    console.log('\n📤 Probando envío de mensaje...');
    console.log('   Conversación ID:', testData.conversationId);
    console.log('   Mensaje:', testData.testMessage);

    // Probar diferentes formatos de payload
    const payloads = [
      {
        name: 'Payload 1 - Simple body',
        data: {
          body: testData.testMessage
        }
      },
      {
        name: 'Payload 2 - Con metadata',
        data: {
          body: testData.testMessage,
          isIncoming: 0,
          sentUsingHostaway: 1
        }
      },
      {
        name: 'Payload 3 - Con tipo',
        data: {
          body: testData.testMessage,
          type: 'host',
          isIncoming: 0
        }
      },
      {
        name: 'Payload 4 - Formato completo',
        data: {
          body: testData.testMessage,
          isIncoming: 0,
          sentUsingHostaway: 1,
          communicationType: 'email'
        }
      }
    ];

    let successfulPayload = null;

    for (const payload of payloads) {
      try {
        console.log(`\n   🧪 Probando ${payload.name}...`);
        console.log('      Payload:', JSON.stringify(payload.data, null, 6));
        
        const result = await service.client.post(`/conversations/${testData.conversationId}/messages`, payload.data);
        
        console.log(`   ✅ ¡${payload.name} exitoso!`);
        console.log('      Resultado:', JSON.stringify(result, null, 6));
        
        successfulPayload = payload;
        break; // Si funciona, paramos aquí para no enviar múltiples mensajes
        
      } catch (error) {
        console.log(`   ❌ ${payload.name} falló: ${error.message}`);
      }
    }

    if (successfulPayload) {
      console.log('\n🎉 ¡ÉXITO! Formato exitoso encontrado:');
      console.log('   Nombre:', successfulPayload.name);
      console.log('   Payload:', JSON.stringify(successfulPayload.data, null, 2));
      console.log('\n📋 Para implementar:');
      console.log('   1. Cambiar endpoint de /reservations/{id}/messages a /conversations/{id}/messages');
      console.log('   2. Usar este formato de payload en HostawayService.js');
      console.log('   3. Asegurarse de que tenemos el conversationId en el webhook');
    } else {
      console.log('\n❌ Ningún formato funcionó. Posibles causas:');
      console.log('   1. Permisos insuficientes en la API key');
      console.log('   2. La conversación no permite nuevos mensajes');
      console.log('   3. Falta algún campo requerido en el payload');
    }

  } catch (error) {
    console.error('💥 Error en la prueba:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Prueba completada');
  console.log('='.repeat(60));
}

// Solo ejecutar si el usuario confirma
if (require.main === module) {
  console.log('⚠️  ADVERTENCIA: Este script enviará un mensaje de prueba real');
  console.log('¿Estás seguro de que quieres continuar? (y/N)');
  
  // Para testing automático, asumimos 'y'
  if (process.env.AUTO_CONFIRM === 'true') {
    testMessageSending().catch(error => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
  } else {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        testMessageSending().catch(error => {
          console.error('💥 Error:', error);
          process.exit(1);
        });
      } else {
        console.log('❌ Prueba cancelada');
      }
    });
  }
}

module.exports = { testMessageSending };