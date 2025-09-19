/**
 * Script simplificado para diagnosticar problemas con la API de Hostaway
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Importamos solo el HostawayService directamente
const { HostawayService } = require('../src/infrastructure/external/hostaway/HostawayService');

async function diagnoseHostawayAPI() {
  console.log('🔧 Diagnóstico de la API de Hostaway');
  console.log('='.repeat(50));

  const service = new HostawayService();

  try {
    // Paso 1: Verificar inicialización del servicio
    console.log('\n📡 Paso 1: Inicializando servicio de Hostaway...');
    await service.initialize();
    console.log('✅ Servicio inicializado correctamente');

    // Paso 2: Probar endpoints básicos
    console.log('\n📋 Paso 2: Probando endpoints básicos...');
    
    const basicEndpoints = [
      '/users/me',
      '/account',
      '/listings',
      '/reservations',
      '/conversations'
    ];

    for (const endpoint of basicEndpoints) {
      try {
        console.log(`   Probando GET ${endpoint}...`);
        const result = await service.client.get(endpoint + '?limit=1');
        console.log(`   ✅ ${endpoint} - Funciona`);
        
        // Si es uno de los endpoints de datos, mostramos un resumen
        if (result.result) {
          if (Array.isArray(result.result)) {
            console.log(`      - Encontrados ${result.result.length} elementos`);
          } else {
            console.log(`      - Datos obtenidos correctamente`);
          }
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
      }
    }

    // Paso 3: Probar con datos específicos del webhook
    console.log('\n🎯 Paso 3: Probando con datos específicos del webhook...');
    
    const webhookData = {
      reservationId: 47773548,
      conversationId: 34132494,
      listingMapId: 234202
    };

    // Probar reservación específica
    try {
      console.log(`   Probando reservación ${webhookData.reservationId}...`);
      const reservation = await service.client.get(`/reservations/${webhookData.reservationId}`);
      console.log('   ✅ Reservación encontrada');
      console.log(`      - Estado: ${reservation.result?.status}`);
      console.log(`      - Listing: ${reservation.result?.listingMapId}`);
      console.log(`      - Huésped: ${reservation.result?.guestName}`);
    } catch (error) {
      console.log(`   ❌ Reservación no encontrada: ${error.message}`);
    }

    // Probar conversación específica
    try {
      console.log(`   Probando conversación ${webhookData.conversationId}...`);
      const conversation = await service.client.get(`/conversations/${webhookData.conversationId}`);
      console.log('   ✅ Conversación encontrada');
      console.log(`      - Reservación: ${conversation.result?.reservationId}`);
      console.log(`      - Canal: ${conversation.result?.channelId}`);
      console.log(`      - Estado: ${conversation.result?.status}`);
    } catch (error) {
      console.log(`   ❌ Conversación no encontrada: ${error.message}`);
    }

    // Probar listing específico
    try {
      console.log(`   Probando listing ${webhookData.listingMapId}...`);
      const listing = await service.client.get(`/listings/${webhookData.listingMapId}`);
      console.log('   ✅ Listing encontrado');
      console.log(`      - Nombre: ${listing.result?.name}`);
      console.log(`      - Estado: ${listing.result?.status}`);
    } catch (error) {
      console.log(`   ❌ Listing no encontrado: ${error.message}`);
    }

    // Paso 4: Explorar endpoints de mensajería disponibles
    console.log('\n📨 Paso 4: Explorando endpoints de mensajería...');
    
    const messagingEndpoints = [
      `/conversations/${webhookData.conversationId}/messages`,
      `/reservations/${webhookData.reservationId}/messages`, 
      `/listings/${webhookData.listingMapId}/messages`,
      `/messages`
    ];

    for (const endpoint of messagingEndpoints) {
      try {
        console.log(`   Probando GET ${endpoint}...`);
        const result = await service.client.get(endpoint + '?limit=1');
        console.log(`   ✅ ${endpoint} - Funciona (GET)`);
        
        // Si funciona el GET, probar POST con datos de prueba (sin enviar realmente)
        console.log(`   🧪 Verificando si ${endpoint} acepta POST...`);
        // No enviamos el POST real para evitar spam, solo vemos si el endpoint existe
        
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
      }
    }

    // Paso 5: Información de la cuenta para verificar permisos
    console.log('\n👤 Paso 5: Verificando permisos de la cuenta...');
    try {
      // Intentar obtener información de la cuenta con diferentes enfoques
      const accountEndpoints = ['/users/me', '/account', '/profile'];
      
      for (const endpoint of accountEndpoints) {
        try {
          const result = await service.client.get(endpoint);
          console.log(`✅ ${endpoint} exitoso:`);
          if (result.result) {
            console.log(`   - ID: ${result.result.id || 'N/A'}`);
            console.log(`   - Nombre: ${result.result.name || result.result.firstName || 'N/A'}`);
            console.log(`   - Email: ${result.result.email || 'N/A'}`);
            console.log(`   - Permisos: ${result.result.permissions || 'N/A'}`);
          }
          break; // Si uno funciona, no necesitamos probar los demás
        } catch (error) {
          console.log(`❌ ${endpoint} falló: ${error.message}`);
        }
      }
    } catch (error) {
      console.log('❌ No se pudo obtener información de la cuenta');
    }

  } catch (error) {
    console.error('💥 Error durante el diagnóstico:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Diagnóstico completado');
  console.log('='.repeat(50));
}

// Ejecutar diagnóstico
if (require.main === module) {
  diagnoseHostawayAPI().catch(error => {
    console.error('💥 Error en el diagnóstico:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseHostawayAPI };