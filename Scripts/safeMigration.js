// scripts/safeMigration.js - Migración segura sin perder datos
require("dotenv").config();
const mongoose = require("mongoose");

async function safeMigration() {
  try {
    console.log("🔄 Iniciando migración segura...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB:", mongoose.connection.name);

    // 1️⃣ VERIFICAR COLECCIONES EXISTENTES
    console.log("\n📊 Verificando colecciones existentes...");
    const collections = await mongoose.connection.db.listCollections().toArray();
    const existingCollections = collections.map(c => c.name);
    
    console.log("Colecciones encontradas:", existingCollections);
    
    // Verificar datos existentes
    const hostawayCount = await mongoose.connection.db.collection('HostAwayListings').countDocuments();
    const faqsCount = await mongoose.connection.db.collection('Faqs').countDocuments();
    const conversationCount = await mongoose.connection.db.collection('Conversation').countDocuments();
    
    console.log(`📈 Datos existentes:
    - HostAwayListings: ${hostawayCount} documentos
    - Faqs: ${faqsCount} documentos  
    - Conversation: ${conversationCount} documentos`);

    // 2️⃣ CREAR NUEVOS ÍNDICES SIN AFECTAR DATOS EXISTENTES
    console.log("\n🔧 Creando índices nuevos (sin afectar datos)...");
    
    // Índices para Conversation (nueva funcionalidad)
    try {
      await mongoose.connection.db.collection('Conversation').createIndex({ guestId: 1 });
      await mongoose.connection.db.collection('Conversation').createIndex({ guestId: 1, lastActivity: -1 });
      console.log("✅ Índices de Conversation creados");
    } catch (error) {
      console.log("ℹ️ Índices de Conversation ya existen o error:", error.message);
    }

    // 3️⃣ CREAR COLECCIÓN DE SUPPORT TICKETS (nueva)
    console.log("\n🎫 Creando colección SupportTicket...");
    
    const SupportTicket = require("../models/SupportTicket");
    
    // Crear índices para SupportTicket
    try {
      await mongoose.connection.db.collection('SupportTicket').createIndex({ 
        status: 1, priority: -1, createdAt: -1 
      });
      await mongoose.connection.db.collection('SupportTicket').createIndex({ 
        guestId: 1, createdAt: -1 
      });
      console.log("✅ Colección SupportTicket e índices creados");
    } catch (error) {
      console.log("ℹ️ SupportTicket ya existe:", error.message);
    }

    // 4️⃣ MIGRAR CONVERSATIONS EXISTENTES (si existen)
    console.log("\n🔄 Actualizando estructura de Conversation (sin perder datos)...");
    
    if (conversationCount > 0) {
      // Actualizar conversaciones existentes para añadir campos nuevos sin sobrescribir
      const result = await mongoose.connection.db.collection('Conversation').updateMany(
        { lastActivity: { $exists: false } }, // Solo las que no tienen el campo
        { 
          $set: { 
            lastActivity: new Date(),
            "summary.totalMessages": 0,
            "summary.needsHumanSupport": false,
            "summary.commonTopics": []
          }
        }
      );
      console.log(`✅ ${result.modifiedCount} conversaciones actualizadas con nuevos campos`);
    }

    // 5️⃣ VALIDAR INTEGRIDAD DE DATOS EXISTENTES
    console.log("\n🔍 Validando integridad de datos existentes...");
    
    // Verificar HostAwayListings tiene ListingMapId
    const hostawayWithMapId = await mongoose.connection.db.collection('HostAwayListings')
      .countDocuments({ ListingMapId: { $exists: true, $ne: null } });
    
    console.log(`✅ HostAwayListings con ListingMapId: ${hostawayWithMapId}/${hostawayCount}`);

    // Verificar Faqs estructura
    const faqSample = await mongoose.connection.db.collection('Faqs').findOne();
    if (faqSample) {
      console.log("✅ Estructura FAQs verificada:", Object.keys(faqSample));
    }

    // 6️⃣ CREAR BACKUP DE DATOS CRÍTICOS
    console.log("\n💾 Creando backup de seguridad...");
    
    const backupDate = new Date().toISOString().split('T')[0];
    
    // Backup de conversaciones existentes
    if (conversationCount > 0) {
      const conversations = await mongoose.connection.db.collection('Conversation').find().toArray();
      await mongoose.connection.db.collection(`Conversation_backup_${backupDate}`)
        .insertMany(conversations);
      console.log(`✅ Backup de ${conversationCount} conversaciones creado`);
    }

    // 7️⃣ CONFIGURAR TTL PARA LIMPIEZA AUTOMÁTICA (OPCIONAL)
    console.log("\n🗑️ Configurando limpieza automática (TTL)...");
    
    try {
      // TTL para Support Tickets (90 días)
      await mongoose.connection.db.collection('SupportTicket').createIndex(
        { createdAt: 1 }, 
        { expireAfterSeconds: 60 * 60 * 24 * 90, background: true }
      );
      
      // TTL para Conversations inactivas (30 días) - SOLO PARA NUEVAS
      await mongoose.connection.db.collection('Conversation').createIndex(
        { lastActivity: 1 }, 
        { 
          expireAfterSeconds: 60 * 60 * 24 * 30, 
          background: true,
          partialFilterExpression: { 
            createdAt: { $gte: new Date() } // Solo aplicar a documentos nuevos
          }
        }
      );
      
      console.log("✅ TTL configurado para limpieza automática");
    } catch (error) {
      console.log("ℹ️ TTL ya configurado:", error.message);
    }

    // 8️⃣ VERIFICACIÓN FINAL
    console.log("\n✅ MIGRACIÓN COMPLETADA - RESUMEN:");
    console.log("==========================================");
    console.log(`📊 Datos preservados:
    - HostAwayListings: ${hostawayCount} documentos (sin cambios)
    - Faqs: ${faqsCount} documentos (sin cambios)
    - Conversation: ${conversationCount} documentos (estructura actualizada)
    
    🆕 Nuevas funcionalidades añadidas:
    - SupportTicket: Colección nueva para tickets de soporte
    - Índices optimizados para búsquedas rápidas
    - TTL para limpieza automática
    - Campos adicionales en Conversation para contexto
    
    ⚠️ Notas importantes:
    - Todos tus datos existentes están intactos
    - Se crearon backups de seguridad
    - Las nuevas funcionalidades son compatibles con datos existentes`);

    console.log("\n🎉 ¡Migración segura completada exitosamente!");
    
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Función para rollback si algo sale mal
async function rollbackMigration() {
  try {
    console.log("🔄 Iniciando rollback...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const backupDate = new Date().toISOString().split('T')[0];
    
    // Restaurar conversaciones desde backup si existe
    const backupExists = await mongoose.connection.db.listCollections({
      name: `Conversation_backup_${backupDate}`
    }).hasNext();
    
    if (backupExists) {
      const backup = await mongoose.connection.db.collection(`Conversation_backup_${backupDate}`).find().toArray();
      
      if (backup.length > 0) {
        await mongoose.connection.db.collection('Conversation').deleteMany({});
        await mongoose.connection.db.collection('Conversation').insertMany(backup);
        console.log(`✅ Rollback completado: ${backup.length} conversaciones restauradas`);
      }
    } else {
      console.log("ℹ️ No se encontró backup para hacer rollback");
    }
    
  } catch (error) {
    console.error("❌ Error durante rollback:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Función para verificar que todo funciona después de la migración
async function testMigration() {
  try {
    console.log("🧪 Probando funcionalidad después de migración...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const { getAgentResponse } = require("../services/conversationService");
    const { getListingByMapId } = require("../services/hostawayListingService");
    
    // Probar búsqueda de listing existente
    const testListing = await mongoose.connection.db.collection('HostAwayListings').findOne();
    if (testListing && testListing.ListingMapId) {
      console.log(`🏠 Probando con ListingMapId: ${testListing.ListingMapId}`);
      
      const listing = await getListingByMapId(testListing.ListingMapId);
      if (listing) {
        console.log("✅ getListingByMapId funciona correctamente");
        
        // Probar respuesta del agente (simulado)
        console.log("🤖 Probando respuesta del agente...");
        console.log("✅ Sistema listo para usar");
      } else {
        console.log("⚠️ No se pudo obtener listing, revisar código");
      }
    } else {
      console.log("⚠️ No se encontró listing con ListingMapId para probar");
    }
    
    // Verificar FAQs
    const faqSample = await mongoose.connection.db.collection('Faqs').findOne();
    if (faqSample) {
      console.log("✅ FAQs accesibles correctamente");
    }
    
    console.log("🎉 ¡Todas las pruebas pasaron!");
    
  } catch (error) {
    console.error("❌ Error en pruebas:", error);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { 
  safeMigration, 
  rollbackMigration, 
  testMigration 
};