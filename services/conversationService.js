// services/conversationService.js
const { searchFAQ } = require("./faqService");
const { getListingByMapId } = require("./hostawayListingService");
const { ask } = require("./gptService");

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

  for (const origKey of Object.keys(flatData)) {
    if (normalizeKey(origKey) === normalizedDetected) {
      return { key: origKey, value: flatData[origKey] };
    }
  }

  if (detectedTokens.length > 0) {
    for (const origKey of Object.keys(flatData)) {
      const nk = normalizeKey(origKey);
      const allMatch = detectedTokens.every(t => nk.includes(t));
      if (allMatch) return { key: origKey, value: flatData[origKey] };
    }
  }

  const qTokens = tokensFromText(userQuestion);
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

async function getAgentResponse(userQuestion, listingMapId) {
  console.log(`💬 Pregunta recibida: "${userQuestion}" (listingMapId: ${listingMapId})`);

  const fieldDetectionPrompt = `
El usuario pregunta: "${userQuestion}"
Devuelve SOLO el nombre del campo en inglés tal como se usaría en la base de datos (ej: checkOutTime, checkInTime, wifi, parking, address).
Si no puedes identificar un campo, responde "unknown".
`;
  let detectedField = (await ask(fieldDetectionPrompt)).trim();
  detectedField = detectedField.split(/[\n,.;:]/)[0].trim();
  console.log("🧠 Campo detectado (raw):", detectedField);

  const listing = await getListingByMapId(listingMapId);
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
      return `${friendly.charAt(0).toUpperCase() + friendly.slice(1)}: ${valueStr}`;
    } else {
      console.log("ℹ️ No se encontró campo coincidente en listing. Keys disponibles:", Object.keys(listing).slice(0, 40));
    }
  } else {
    console.log("⚠️ Listing no encontrado con id:", listingMapId);
  }

  const faqAnswer = await searchFAQ(userQuestion);
  if (faqAnswer) {
    console.log("📚 Respuesta tomada de FAQs");
    return faqAnswer;
  }

  console.log("🚨 No encontrado en HostAwaylisting collection ni FAQs collection. Usando GPT como fallback.");
  const fallbackPrompt = `
Eres un asistente amable y puntual.
Pregunta: "${userQuestion}"
No existe la información en la base de datos ni en las FAQs.
Responde lo mejor posible usando conocimiento general.
`;
  return await ask(fallbackPrompt);
}


module.exports = { getAgentResponse };
