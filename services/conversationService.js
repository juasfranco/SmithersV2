// services/conversationService.js - VERSIÓN MEJORADA
const { searchFAQ } = require("./faqService");
const { getListingByMapId } = require("./hostawayListingService");
const { ask, getFriendlyResponse } = require("./gptService");
const { saveConversation, getConversationHistory } = require("./conversationHistoryService");
const { notifySupport } = require("./supportNotificationService");
const Conversation = require("../models/conversation");

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_\-]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function tokensFromText(text) {
  if (!text) return [];
  const spaced = String(text).replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced
    .replace(/[_\-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function findMatchingField(flatData, detectedField, userQuestion) {
  if (!flatData) return null;
  const normalizedDetected = normalizeKey(detectedField);
  const detectedTokens = tokensFromText(detectedField);
  const qTokens = tokensFromText(userQuestion);

  // 1️⃣ Coincidencia exacta de clave normalizada
  for (const origKey of Object.keys(flatData)) {
    if (normalizeKey(origKey) === normalizedDetected) {
      return { key: origKey, value: flatData[origKey] };
    }
  }

  // 2️⃣ Coincidencia parcial: buscar todas las que encajen
  let partialMatches = [];
  if (detectedTokens.length > 0) {
    for (const origKey of Object.keys(flatData)) {
      const nk = normalizeKey(origKey);
      const allMatch = detectedTokens.every(t => nk.includes(t));
      if (allMatch) partialMatches.push(origKey);
    }
  }

  // Si hay varias coincidencias parciales, aplicar reglas
  if (partialMatches.length > 0) {
    // Si la pregunta menciona start/begin → priorizar Start
    if (qTokens.some(t => ["start", "begin", "from"].includes(t.toLowerCase()))) {
      const startKey = partialMatches.find(k => /start/i.test(k));
      if (startKey) return { key: startKey, value: flatData[startKey] };
    }
    // Si la pregunta menciona end/late → priorizar End
    if (qTokens.some(t => ["end", "late", "until"].includes(t.toLowerCase()))) {
      const endKey = partialMatches.find(k => /end/i.test(k));
      if (endKey) return { key: endKey, value: flatData[endKey] };
    }
    // Si no hay pistas, priorizar Start sobre End
    const startKey = partialMatches.find(k => /start/i.test(k));
    if (startKey) return { key: startKey, value: flatData[startKey] };

    // Si no hay Start, devolver el primero encontrado
    return { key: partialMatches[0], value: flatData[partialMatches[0]] };
  }

  // 3️⃣ Buscar coincidencia por valor
  if (qTokens.length > 0) {
    for (const origKey of Object.keys(flatData)) {
      const val = flatData[origKey];
      if (typeof val === "string" && val.trim()) {
        const valLower = val.toLowerCase();
        if (qTokens.some(t => valLower.includes(t))) {
          return { key: origKey, value: val };
        }
      }
    }
  }

  return null;
}

function friendlyFieldName(detectedField, origKey) {
  const nk = normalizeKey(detectedField || origKey || "");
  const map = {
    checkintime: "hora de check-in",
    checkouttime: "hora de check-out",
    wifi: "Wi-Fi",
    wifipassword: "contraseña de Wi-Fi",
    wifiusername: "usuario de Wi-Fi",
    address: "dirección",
    phone: "teléfono",
  };
  if (map[nk]) return map[nk];
  if (origKey) {
    return origKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-]/g, " ");
  }
  return (detectedField || origKey || "").toString();
}

async function getAgentResponse(userQuestion, listingMapId, guestId, reservationId) {
  console.log(`💬 Pregunta recibida: "${userQuestion}" (listingMapId: ${listingMapId}, guestId: ${guestId})`);

  try {
    // 🔹 NUEVO: Obtener historial de conversación para contexto
    const conversationHistory = await getConversationHistory(guestId);

    // 🔹 NUEVO: Guardar mensaje del huésped
    await saveConversation(guestId, "guest", userQuestion);

    // Generar prompt con contexto histórico
    const contextPrompt = conversationHistory.length > 0
      ? `Historial de conversación reciente:\n${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: "${userQuestion}"`
      : `Pregunta: "${userQuestion}"`;

    const fieldDetectionPrompt = `
Contexto de conversación:
${contextPrompt}

Identifica el campo específico que el usuario está preguntando.
Devuelve SOLO el nombre del campo en inglés tal como se usaría en la base de datos (ej: checkOutTime, checkInTime, wifi, parking, address).
Si no puedes identificar un campo específico, responde "unknown".
    `;

    let detectedField = (await ask(fieldDetectionPrompt)).trim();
    detectedField = detectedField.split(/[\n,.;:]/)[0].trim();
    console.log("🧠 Campo detectado (con contexto):", detectedField);

    // Buscar información en el listing
    const listing = await getListingByMapId(listingMapId);
    let response = null;
    let responseSource = "unknown";

    if (listing) {
      console.log("🏠 Listing encontrado; buscando campo...");
      const match = findMatchingField(listing, detectedField, userQuestion);
      if (match) {
        let rawValue = match.value;
        let valueStr;
        if (rawValue === null || rawValue === undefined) valueStr = String(rawValue);
        else if (typeof rawValue === "object") {
          try { valueStr = JSON.stringify(rawValue); } catch { valueStr = String(rawValue); }
        } else valueStr = String(rawValue);

        const friendly = friendlyFieldName(detectedField, match.key);
        console.log("✅ Match en HostawayListing:", match.key, "=>", valueStr);

        // 📌 Usar contexto para respuesta más personalizada
        const contextualPrompt = conversationHistory.length > 0
          ? `Basado en nuestra conversación previa y tu pregunta sobre "${userQuestion}", la información es: ${friendly}: ${valueStr}`
          : `${friendly}: ${valueStr}`;

        response = await getFriendlyResponse(userQuestion, contextualPrompt);
        responseSource = "listing";
      }
    }

    // Si no se encontró en listing, buscar en FAQs
    if (!response) {
      const faqAnswer = await searchFAQ(userQuestion, conversationHistory);
      if (faqAnswer) {
        console.log("📚 Respuesta tomada de FAQs");
        response = await getFriendlyResponse(userQuestion, faqAnswer);
        responseSource = "faq";
      }
    }

    // Si no se encontró respuesta, usar fallback con contexto
    if (!response) {
      console.log("🚨 No encontrado en ninguna fuente. Usando GPT como fallback.");

      const fallbackPrompt = `
Eres un asistente amable y profesional para huéspedes de alojamientos.
${conversationHistory.length > 0 ? `Contexto de conversación previa:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n` : ''}
Pregunta actual: "${userQuestion}"

No tienes información específica sobre este tema en la base de datos.
Responde de manera útil pero indica que necesitas verificar la información o que el huésped puede contactar directamente al anfitrión.
Mantén un tono cordial y profesional.
      `;

      response = await ask(fallbackPrompt);
      responseSource = "fallback";

      // 🔹 NUEVO: Notificar a soporte cuando se usa fallback
      await notifySupport({
        guestId,
        reservationId,
        listingMapId,
        question: userQuestion,
        response,
        reason: "No se encontró respuesta en la base de datos"
      });
    }

    // 🔹 NUEVO: Guardar respuesta del agente
    await saveConversation(guestId, "agent", response, {
      source: responseSource,
      detectedField,
      listingMapId
    });

    console.log(`✅ Respuesta generada (fuente: ${responseSource}):`, response);
    return response;

  } catch (error) {
    console.error("❌ Error en getAgentResponse:", error);

    // 🔹 NUEVO: Notificar error crítico a soporte
    await notifySupport({
      guestId,
      reservationId,
      listingMapId,
      question: userQuestion,
      error: error.message,
      reason: "Error técnico en el agente"
    });

    return "Disculpa, estoy experimentando dificultades técnicas. Un miembro de nuestro equipo te contactará pronto para ayudarte.";
  }
}

module.exports = { getAgentResponse };