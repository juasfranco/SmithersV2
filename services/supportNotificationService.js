// services/supportNotificationService.js
const axios = require("axios");

/**
 * Notifica al equipo de soporte cuando el agente no puede resolver una consulta
 */
async function notifySupport({ guestId, reservationId, listingMapId, question, response, error, reason }) {
  try {
    const notification = {
      timestamp: new Date().toISOString(),
      guestId,
      reservationId,
      listingMapId,
      question,
      response: response || null,
      error: error || null,
      reason,
      priority: determinePriority(reason, error)
    };

    // Enviar por WhatsApp
    await sendWhatsAppNotification(notification);
    
    // Guardar en base de datos para seguimiento
    await saveSupportTicket(notification);
    
    console.log("📢 Notificación de soporte enviada:", reason);
    
  } catch (notificationError) {
    console.error("❌ Error enviando notificación de soporte:", notificationError);
  }
}

function determinePriority(reason, error) {
  if (error) return "high";
  if (reason.includes("Error técnico")) return "high";
  if (reason.includes("No se encontró respuesta")) return "medium";
  return "low";
}

async function sendWhatsAppNotification(notification) {
  const whatsappConfig = {
    phoneNumber: process.env.SUPPORT_WHATSAPP_NUMBER, // +1234567890
    apiUrl: process.env.WHATSAPP_API_URL, // Tu API de WhatsApp (ej: Twilio, Meta Business)
    apiToken: process.env.WHATSAPP_API_TOKEN
  };

  const message = formatWhatsAppMessage(notification);
  
  // Ejemplo usando Twilio WhatsApp API
  if (whatsappConfig.apiUrl && whatsappConfig.apiToken) {
    try {
      await axios.post(
        whatsappConfig.apiUrl,
        {
          to: `whatsapp:${whatsappConfig.phoneNumber}`,
          body: message
        },
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error("❌ Error enviando WhatsApp:", error.response?.data || error.message);
    }
  } else {
    // Fallback: log en consola si no está configurado
    console.log("📱 NOTIFICACIÓN WHATSAPP (simulada):");
    console.log(message);
  }
}

function formatWhatsAppMessage(notification) {
  const { guestId, reservationId, question, reason, priority, timestamp } = notification;
  
  const priorityEmoji = {
    high: "🔴",
    medium: "🟡",
    low: "🟢"
  }[priority] || "⚪";

  return `${priorityEmoji} *SOPORTE AGENTE VIRTUAL*

📅 ${new Date(timestamp).toLocaleString('es-ES')}
🏠 Reserva: ${reservationId}
👤 Huésped: ${guestId}

❓ *Pregunta:*
${question}

⚠️ *Motivo:*
${reason}

🔗 Revisar: ${process.env.ADMIN_PANEL_URL || 'Panel de administración'}`;
}

async function saveSupportTicket(notification) {
  try {
    // Aquí podrías guardar en una colección de tickets de soporte
    const SupportTicket = require("../models/SupportTicket"); // Crear este modelo
    
    const ticket = new SupportTicket({
      guestId: notification.guestId,
      reservationId: notification.reservationId,
      listingMapId: notification.listingMapId,
      question: notification.question,
      reason: notification.reason,
      priority: notification.priority,
      status: "open",
      createdAt: new Date(),
      metadata: {
        response: notification.response,
        error: notification.error
      }
    });

    await ticket.save();
    console.log("🎫 Ticket de soporte creado:", ticket._id);
    
  } catch (error) {
    console.error("❌ Error guardando ticket:", error);
  }
}

module.exports = {
  notifySupport,
  sendWhatsAppNotification
};