function buildPrompt({ faqs, history, guestQuestion }) {
  const faqContext = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  const historyContext = history
    .map(msg => `${msg.role === "guest" ? "Huésped" : "Agente"}: ${msg.content}`)
    .join("\n");

  return `
Estás actuando como un asistente virtual profesional para propiedades de Airbnb.

FAQs disponibles:
${faqContext || "No hay FAQs definidas."}

Historial reciente con este huésped:
${historyContext || "No hay conversaciones previas."}

Nueva pregunta del huésped:
${guestQuestion}

Tu respuesta debe ser clara, profesional, en el mismo idioma que la pregunta, y útil.
Si ya se respondió anteriormente, recuérdalo con amabilidad.
`;
}

module.exports = { buildPrompt };
