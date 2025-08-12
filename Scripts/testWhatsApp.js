// scripts/testWhatsApp.js - Script para probar notificaciones de WhatsApp
require("dotenv").config();
const { sendWhatsAppNotification } = require("../services/supportNotificationService");

async function testWhatsAppNotification() {
  console.log("🧪 Probando notificación de WhatsApp...");
  
  const testNotification = {
    timestamp: new Date().toISOString(),
    guestId: "test-guest-123",
    reservationId: "RES-456",
    listingMapId: 789,
    question: "¿A qué hora es el check-in?",
    response: "Lo siento, no pude encontrar esa información.",
    reason: "Prueba del sistema de notificaciones",
    priority: "medium"
  };

  try {
    await sendWhatsAppNotification(testNotification);
    console.log("✅ Notificación de prueba enviada exitosamente");
  } catch (error) {
    console.error("❌ Error enviando notificación de prueba:", error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testWhatsAppNotification()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error en prueba:", error);
      process.exit(1);
    });
}

module.exports = { testWhatsAppNotification };