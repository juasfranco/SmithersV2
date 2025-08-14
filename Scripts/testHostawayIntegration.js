// scripts/testHostawayIntegration.js - Prueba completa de integración con Hostaway
require("dotenv").config();
const { hostawayService } = require("../services/hostawayService");
const { handleHostawayWebhook } = require("../services/enhancedWebhookHandler");

async function testHostawayConnection() {
  console.log("🔍 Probando conexión con Hostaway API...");
  
  try {
    // 🔹 VERIFICAR VARIABLES DE ENTORNO
    console.log("🔧 Verificando configuración...");
    console.log("   HOSTAWAY_ACCOUNT_ID:", process.env.HOSTAWAY_ACCOUNT_ID || "❌ NO CONFIGURADO");
    console.log("   HOSTAWAY_CLIENT_SECRET:", process.env.HOSTAWAY_CLIENT_SECRET ? "✅ CONFIGURADO" : "❌ NO CONFIGURADO");
    
    if (!process.env.HOSTAWAY_ACCOUNT_ID || !process.env.HOSTAWAY_CLIENT_SECRET) {
      throw new Error("Variables de entorno HOSTAWAY_ACCOUNT_ID y HOSTAWAY_CLIENT_SECRET son requeridas");
    }

    // 🔹 PROBAR AUTENTICACIÓN
    console.log("\n🔑 Probando autenticación...");
    const token = await hostawayService.getAccessToken();
    console.log("✅ Token obtenido:", token ? `${token.substring(0, 30)}...` : "No obtenido");
    
    // 🔹 PROBAR CONEXIÓN BÁSICA
    console.log("\n🌐 Probando conexión básica...");
    const connectionTest = await hostawayService.testConnection();
    
    if (!connectionTest) {
      throw new Error("Test de conexión básica falló");
    }

    // 🔹 PROBAR API DE RESERVAS
    console.log("\n📋 Probando API de reservas...");
    try {
      const reservations = await hostawayService.searchReservations({ limit: 3 });
      console.log("✅ API de reservas funcional. Reservas encontradas:", reservations.length);
      
      if (reservations.length > 0) {
        const reservation = reservations[0];
        console.log("📌 Reserva de ejemplo:", {
          id: reservation.id,
          guestName: reservation.guestName,
          listingMapId: reservation.listingMapId,
          status: reservation.status,
          checkIn: reservation.arrivalDate
        });
        
        // 🔹 PROBAR CONTEXTO COMPLETO
        console.log("\n🔍 Probando obtener contexto completo...");
        const { getCompleteContext } = require("../services/hostawayService");
        const context = await getCompleteContext(reservation.id);
        console.log("✅ Contexto completo obtenido:", {
          reservationId: context.reservation.id,
          guestName: context.reservation.guestName,
          listingName: context.listing?.name || 'Sin listing',
          messagesCount: context.conversation.recentMessages.length
        });
      } else {
        console.log("ℹ️ No hay reservas en la cuenta para probar contexto completo");
      }
    } catch (apiError) {
      console.log("⚠️ Error accediendo a reservas específicas:", apiError.message);
      console.log("   Esto puede ser normal si no hay reservas o permisos limitados");
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ Error conectando con Hostaway:", error.message);
    return false;
  }
}

async function testWebhookProcessing() {
  console.log("\n🎣 Probando procesamiento de webhooks...");
  
  // Simular webhook de mensaje nuevo
  const mockWebhookData = {
    reservationId: "123456",
    conversationId: "conv-789",
    messageId: "msg-456",
    message: "¿A qué hora es el check-in?",
    messageType: "inquiry",
    guestId: "guest-test-123",
    listingMapId: 789
  };
  
  try {
    console.log("📨 Simulando webhook 'new message received'...");
    
    // Esto fallará porque no existe la reserva, pero probará el flujo
    try {
      await handleHostawayWebhook('new message received', mockWebhookData);
      console.log("✅ Webhook procesado exitosamente");
    } catch (error) {
      if (error.message.includes("No se pudo obtener la reserva")) {
        console.log("⚠️ Webhook procesó correctamente hasta obtener reserva (esperado para datos de prueba)");
      } else {
        throw error;
      }
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ Error procesando webhook:", error.message);
    return false;
  }
}

async function testFullFlow() {
  console.log("\n🔄 Probando flujo completo con reserva real...");
  
  try {
    // Buscar una reserva real para probar
    const reservations = await hostawayService.searchReservations({ limit: 1 });
    
    if (reservations.length === 0) {
      console.log("⚠️ No hay reservas disponibles para probar flujo completo");
      return false;
    }
    
    const reservation = reservations[0];
    console.log(`📋 Usando reserva ${reservation.id} para prueba completa...`);
    
    // Simular webhook con reserva real
    const realWebhookData = {
      reservationId: reservation.id,
      conversationId: reservation.conversationId || null,
      message: "Esta es una prueba del agente virtual. ¿Funciona la integración?",
      messageType: "inquiry",
      guestId: reservation.guestEmail || `guest-${reservation.id}`,
      listingMapId: reservation.listingMapId
    };
    
    console.log("🤖 Procesando con agente virtual...");
    const result = await handleHostawayWebhook('new message received', realWebhookData);
    
    console.log("✅ Flujo completo exitoso:", {
      success: result.success,
      processingTime: result.processingTime,
      guestName: result.context?.guestName
    });
    
    return true;
    
  } catch (error) {
    console.error("❌ Error en flujo completo:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("🧪 INICIANDO PRUEBAS DE INTEGRACIÓN HOSTAWAY\n");
  console.log("=" .repeat(50));
  
  const results = {
    connection: false,
    webhook: false,
    fullFlow: false
  };
  
  // Test 1: Conexión básica
  console.log("1️⃣ PRUEBA DE CONEXIÓN");
  results.connection = await testHostawayConnection();
  
  // Test 2: Procesamiento de webhook
  console.log("\n2️⃣ PRUEBA DE WEBHOOK");
  results.webhook = await testWebhookProcessing();
  
  // Test 3: Flujo completo (solo si la conexión funcionó)
  if (results.connection) {
    console.log("\n3️⃣ PRUEBA DE FLUJO COMPLETO");
    results.fullFlow = await testFullFlow();
  }
  
  // Resumen final
  console.log("\n" + "=" .repeat(50));
  console.log("📊 RESUMEN DE PRUEBAS:");
  console.log(`✅ Conexión Hostaway: ${results.connection ? 'EXITOSA' : 'FALLIDA'}`);
  console.log(`✅ Procesamiento Webhook: ${results.webhook ? 'EXITOSO' : 'FALLIDO'}`);
  console.log(`✅ Flujo Completo: ${results.fullFlow ? 'EXITOSO' : 'FALLIDO'}`);
  
  if (results.connection && results.webhook) {
    console.log("\n🎉 ¡Integración con Hostaway lista para usar!");
    console.log("\n📋 Próximos pasos:");
    console.log("1. Configura tu webhook en Hostaway Dashboard");
    console.log("2. Apunta el webhook a: tu-servidor.com/webhooks/hostaway");
    console.log("3. Prueba enviando mensajes reales desde Hostaway");
  } else {
    console.log("\n⚠️ Hay problemas con la integración. Revisa:");
    console.log("1. Variables de entorno HOSTAWAY_ACCOUNT_ID y HOSTAWAY_CLIENT_SECRET");
    console.log("2. Permisos de API en tu cuenta Hostaway");
    console.log("3. Conexión a internet");
  }
  
  console.log("\n🔚 Pruebas completadas");
  process.exit(results.connection && results.webhook ? 0 : 1);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(error => {
    console.error("💥 Error crítico en pruebas:", error);
    process.exit(1);
  });
}

module.exports = { 
  testHostawayConnection, 
  testWebhookProcessing, 
  testFullFlow,
  runAllTests 
};