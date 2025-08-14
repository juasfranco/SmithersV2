// services/enhancedWebhookHandler.js - MANEJO MEJORADO DE WEBHOOKS
const { getCompleteContext, sendMessageToGuest } = require("./hostawayService");
const { getAgentResponse } = require("./conversationService");
const { saveConversation } = require("./conversationHistoryService");
const { notifySupport } = require("./supportNotificationService");

/**
 * Maneja webhook de "new message received" con datos completos de Hostaway
 */
async function handleNewMessageWebhook(webhookData) {
  const startTime = Date.now();
  
  try {
    console.log("📨 Procesando webhook 'new message received':", {
      timestamp: new Date().toISOString(),
      data: webhookData
    });

    // 🔹 EXTRAER DATOS DEL WEBHOOK
    const {
      reservationId,
      conversationId,
      messageId,
      message,
      messageType,
      guestId,
      listingMapId
    } = webhookData;

    // Validar datos requeridos
    if (!reservationId || !message) {
      throw new Error("Datos insuficientes en webhook: se requiere reservationId y message");
    }

    console.log("📋 Datos del webhook:", {
      reservationId,
      conversationId,
      messageId,
      messageType,
      messagePreview: message.substring(0, 100)
    });

    // 🔹 OBTENER CONTEXTO COMPLETO DE HOSTAWAY
    console.log("🔍 Obteniendo contexto completo desde Hostaway...");
    const context = await getCompleteContext(reservationId, conversationId);

    // 🔹 ENRIQUECER DATOS LOCALES
    const enrichedGuestId = guestId || context.reservation.guestEmail || `guest-${reservationId}`;
    const enrichedListingMapId = listingMapId || context.reservation.listingMapId;

    console.log("📊 Contexto obtenido:", {
      guestName: context.reservation.guestName,
      listingName: context.listing?.name,
      checkIn: context.reservation.checkInDate,
      checkOut: context.reservation.checkOutDate,
      recentMessagesCount: context.conversation.recentMessages.length
    });

    // 🔹 GUARDAR MENSAJE DEL HUÉSPED EN HISTORIAL LOCAL
    await saveConversation(enrichedGuestId, "guest", message, {
      reservationId,
      conversationId,
      messageId,
      hostaway: true,
      context: {
        guestName: context.reservation.guestName,
        listingName: context.listing?.name,
        checkInDate: context.reservation.checkInDate
      }
    });

    // 🔹 GENERAR RESPUESTA DEL AGENTE CON CONTEXTO COMPLETO
    console.log("🤖 Generando respuesta del agente con contexto completo...");
    
    const agentResponse = await getAgentResponseWithContext(
      message,
      enrichedListingMapId,
      enrichedGuestId,
      reservationId,
      context
    );

    // 🔹 ENVIAR RESPUESTA ATTRAVERSO HOSTAWAY
    console.log("📤 Enviando respuesta através de Hostaway...");
    const messageSent = await sendMessageToGuest(reservationId, agentResponse);

    if (messageSent) {
      // 🔹 GUARDAR RESPUESTA EN HISTORIAL LOCAL
      await saveConversation(enrichedGuestId, "agent", agentResponse, {
        reservationId,
        conversationId,
        hostawayMessageId: messageSent.id,
        hostaway: true,
        context: {
          source: "enhanced_agent",
          processingTime: Date.now() - startTime
        }
      });

      console.log("✅ Mensaje procesado y enviado exitosamente");
      
      return {
        success: true,
        processingTime: Date.now() - startTime,
        context: {
          reservationId,
          guestName: context.reservation.guestName,
          listingName: context.listing?.name,
          responseLength: agentResponse.length
        }
      };
    } else {
      throw new Error("No se pudo enviar el mensaje através de Hostaway");
    }

  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    
    // 🔹 NOTIFICAR ERROR A SOPORTE
    try {
      await notifySupport({
        guestId: webhookData.guestId || "unknown",
        reservationId: webhookData.reservationId || "unknown", 
        listingMapId: webhookData.listingMapId || 0,
        question: webhookData.message || "Error procesando webhook",
        error: error.message,
        reason: "Error crítico en webhook con datos de Hostaway",
        priority: "high"
      });
    } catch (notifyError) {
      console.error("❌ Error adicional notificando:", notifyError);
    }

    throw error;
  }
}

/**
 * Maneja webhook de "reservation created" 
 */
async function handleReservationCreatedWebhook(webhookData) {
  try {
    console.log("🏠 Procesando webhook 'reservation created':", webhookData);
    
    const { reservationId } = webhookData;
    
    // Obtener datos completos de la reserva
    const context = await getCompleteContext(reservationId);
    
    console.log("✅ Nueva reserva registrada:", {
      id: context.reservation.id,
      guestName: context.reservation.guestName,
      listingName: context.listing?.name,
      checkIn: context.reservation.checkInDate
    });

    // Aquí podrías enviar mensaje de bienvenida automático
    // await sendWelcomeMessage(context);

    return { success: true, reservationId };

  } catch (error) {
    console.error("❌ Error procesando reservation created:", error);
    throw error;
  }
}

/**
 * Maneja webhook de "reservation updated"
 */
async function handleReservationUpdatedWebhook(webhookData) {
  try {
    console.log("🔄 Procesando webhook 'reservation updated':", webhookData);
    
    const { reservationId, changes } = webhookData;
    
    // Si cambió algo importante (fechas, huéspedes), actualizar contexto
    if (changes?.includes('dates') || changes?.includes('guests')) {
      const context = await getCompleteContext(reservationId);
      console.log("📅 Reserva actualizada:", {
        id: context.reservation.id,
        newCheckIn: context.reservation.checkInDate,
        newCheckOut: context.reservation.checkOutDate
      });
    }

    return { success: true, reservationId };

  } catch (error) {
    console.error("❌ Error procesando reservation updated:", error);
    throw error;
  }
}

/**
 * Generar respuesta del agente con contexto completo de Hostaway
 */
async function getAgentResponseWithContext(message, listingMapId, guestId, reservationId, hostawayContext) {
  try {
    console.log("🧠 Generando respuesta con contexto Hostaway completo...");

    // Crear contexto enriquecido para el agente
    const enrichedContext = {
      guest: {
        name: hostawayContext.reservation.guestName,
        email: hostawayContext.reservation.guestEmail,
        phone: hostawayContext.reservation.guestPhone,
        numberOfGuests: hostawayContext.reservation.numberOfGuests
      },
      reservation: {
        id: hostawayContext.reservation.id,
        checkIn: hostawayContext.reservation.checkInDate,
        checkOut: hostawayContext.reservation.checkOutDate,
        status: hostawayContext.reservation.status,
        totalPrice: hostawayContext.reservation.totalPrice,
        currency: hostawayContext.reservation.currency,
        source: hostawayContext.reservation.source
      },
      property: hostawayContext.listing ? {
        name: hostawayContext.listing.name,
        address: hostawayContext.listing.address,
        checkInTime: hostawayContext.listing.checkInTime,
        checkOutTime: hostawayContext.listing.checkOutTime,
        wifi: {
          username: hostawayContext.listing.wifiUsername,
          password: hostawayContext.listing.wifiPassword
        },
        doorCode: hostawayContext.listing.doorCode,
        specialInstructions: hostawayContext.listing.specialInstructions,
        houseRules: hostawayContext.listing.houseRules,
        contact: {
          name: hostawayContext.listing.contactName,
          phone: hostawayContext.listing.contactPhone,
          email: hostawayContext.listing.contactEmail
        }
      } : null,
      conversationHistory: hostawayContext.conversation.recentMessages.map(msg => ({
        content: msg.message,
        isFromGuest: msg.isFromGuest,
        timestamp: msg.sentAt
      }))
    };

    // Llamar al agente con contexto enriquecido
    return await getAgentResponse(
      message, 
      listingMapId, 
      guestId, 
      reservationId,
      enrichedContext // Pasar contexto enriquecido
    );

  } catch (error) {
    console.error("❌ Error generando respuesta con contexto:", error);
    
    // Fallback: usar agente normal si falla el contexto enriquecido
    return await getAgentResponse(message, listingMapId, guestId, reservationId);
  }
}

/**
 * Función principal para manejar todos los tipos de webhook
 */
async function handleHostawayWebhook(event, data) {
  console.log(`🎣 Procesando webhook Hostaway: ${event}`);

  switch (event) {
    case 'new message received':
    case 'messageCreated': // Compatibilidad con webhook anterior
      return await handleNewMessageWebhook(data);
      
    case 'reservation created':
      return await handleReservationCreatedWebhook(data);
      
    case 'reservation updated': 
      return await handleReservationUpdatedWebhook(data);
      
    default:
      console.log(`ℹ️ Evento webhook no manejado: ${event}`);
      return { success: true, message: "Evento no manejado pero recibido" };
  }
}

module.exports = {
  handleHostawayWebhook,
  handleNewMessageWebhook,
  handleReservationCreatedWebhook,
  handleReservationUpdatedWebhook,
  getAgentResponseWithContext
};