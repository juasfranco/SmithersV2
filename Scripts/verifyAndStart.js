// scripts/verifyAndStart.js - Script para verificar y corregir problemas
require("dotenv").config();
const mongoose = require("mongoose");

async function verifyDatabaseCollections() {
  try {
    console.log("🔍 Verificando colecciones de base de datos...");
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB:", mongoose.connection.name);
    
    // Listar colecciones existentes
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log("📁 Colecciones encontradas:", collectionNames);
    
    // Verificar colecciones esperadas
    const expectedCollections = ['HostAwayListings', 'Faqs', 'Conversation'];
    const missingCollections = expectedCollections.filter(name => !collectionNames.includes(name));
    
    if (missingCollections.length > 0) {
      console.log("⚠️ Colecciones faltantes:", missingCollections);
    } else {
      console.log("✅ Todas las colecciones esperadas están presentes");
    }
    
    // Verificar datos en cada colección
    for (const collectionName of expectedCollections) {
      if (collectionNames.includes(collectionName)) {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments();
        console.log(`📊 ${collectionName}: ${count} documentos`);
        
        // Mostrar un documento de ejemplo si existe
        if (count > 0) {
          const sample = await mongoose.connection.db.collection(collectionName).findOne();
          console.log(`📄 Estructura de ${collectionName}:`, Object.keys(sample));
        }
      }
    }
    
    // Verificar índices
    console.log("\n🔍 Verificando índices...");
    for (const collectionName of expectedCollections) {
      if (collectionNames.includes(collectionName)) {
        const indexes = await mongoose.connection.db.collection(collectionName).indexes();
        console.log(`📇 Índices en ${collectionName}:`, indexes.map(i => i.name));
      }
    }
    
    return true;
    
  } catch (error) {
    console.error("❌ Error verificando base de datos:", error);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

async function testModelsConnection() {
  try {
    console.log("\n🧪 Probando conexión de modelos...");
    
    // Importar modelos (esto nos dirá si hay conflictos)
    const Faqs = require("../models/Faqs");
    const HostAwayListings = require("../models/HostAwayListings");
    const Conversation = require("../models/conversation");
    const SupportTicket = require("../models/SupportTicket");
    
    console.log("✅ Todos los modelos importados sin errores");
    
    // Conectar nuevamente
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Probar una consulta simple con cada modelo
    const faqCount = await Faqs.countDocuments();
    const listingCount = await HostAwayListings.countDocuments();
    const conversationCount = await Conversation.countDocuments();
    const ticketCount = await SupportTicket.countDocuments();
    
    console.log("📊 Conteos usando modelos:");
    console.log(`   - Faqs: ${faqCount}`);
    console.log(`   - HostAwayListings: ${listingCount}`);
    console.log(`   - Conversation: ${conversationCount}`);
    console.log(`   - SupportTicket: ${ticketCount}`);
    
    return true;
    
  } catch (error) {
    console.error("❌ Error probando modelos:", error);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

async function testConversationSave() {
  try {
    console.log("\n💬 Probando guardado de conversación...");
    
    const { saveConversation, getConversationHistory } = require("../services/conversationHistoryService");
    
    // Probar guardado
    await saveConversation("test-guest-startup", "guest", "Mensaje de prueba durante startup");
    await saveConversation("test-guest-startup", "agent", "Respuesta de prueba durante startup");
    
    // Probar recuperación
    const history = await getConversationHistory("test-guest-startup");
    
    if (history.length >= 2) {
      console.log("✅ Guardado y recuperación de conversaciones funciona correctamente");
      return true;
    } else {
      console.log("⚠️ No se pudo recuperar el historial completo");
      return false;
    }
    
  } catch (error) {
    console.error("❌ Error probando conversación:", error);
    return false;
  }
}

async function runCompleteVerification() {
  console.log("🚀 VERIFICACIÓN COMPLETA DEL SISTEMA");
  console.log("=" .repeat(50));
  
  const results = {
    database: false,
    models: false,
    conversation: false
  };
  
  // Test 1: Verificar base de datos
  console.log("\n1️⃣ VERIFICACIÓN DE BASE DE DATOS");
  results.database = await verifyDatabaseCollections();
  
  // Test 2: Verificar modelos
  console.log("\n2️⃣ VERIFICACIÓN DE MODELOS");
  results.models = await testModelsConnection();
  
  // Test 3: Verificar funcionalidad de conversaciones
  console.log("\n3️⃣ VERIFICACIÓN DE CONVERSACIONES");
  results.conversation = await testConversationSave();
  
  // Resumen
  console.log("\n" + "=" .repeat(50));
  console.log("📊 RESUMEN DE VERIFICACIÓN:");
  console.log(`✅ Base de Datos: ${results.database ? 'CORRECTA' : 'CON PROBLEMAS'}`);
  console.log(`✅ Modelos: ${results.models ? 'CORRECTOS' : 'CON PROBLEMAS'}`);
  console.log(`✅ Conversaciones: ${results.conversation ? 'FUNCIONANDO' : 'CON PROBLEMAS'}`);
  
  const allGood = Object.values(results).every(r => r === true);
  
  if (allGood) {
    console.log("\n🎉 ¡Sistema verificado y listo para usar!");
    console.log("\n📋 Puedes iniciar el servidor con: node server.js");
  } else {
    console.log("\n⚠️ Hay problemas que necesitan atención:");
    
    if (!results.database) {
      console.log("• Revisa tu conexión a MongoDB y las colecciones");
    }
    if (!results.models) {
      console.log("• Hay conflictos en los modelos de Mongoose");
    }
    if (!results.conversation) {
      console.log("• La funcionalidad de conversaciones no está trabajando");
    }
  }
  
  process.exit(allGood ? 0 : 1);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runCompleteVerification().catch(error => {
    console.error("💥 Error crítico en verificación:", error);
    process.exit(1);
  });
}

module.exports = { 
  verifyDatabaseCollections,
  testModelsConnection,
  testConversationSave,
  runCompleteVerification
};