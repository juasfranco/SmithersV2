// services/gptService.js
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Envía un prompt directo a GPT y devuelve la respuesta.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function ask(prompt) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  });
  return completion.choices[0].message.content;
}

/**
 * Genera un mensaje cordial y profesional para un huésped
 * basado en una pregunta y una respuesta/dato.
 * @param {string} question - Pregunta original del huésped
 * @param {string} answer - Respuesta o dato principal
 * @returns {Promise<string>}
 */
async function getFriendlyResponse(question, answer) {
  const prompt = `
Genera una respuesta breve, amable y personalizada para un huésped,
usando el siguiente dato como respuesta principal:

Pregunta: "${question}"
Dato: "${answer}"

Reglas:
- No uses plantillas ni marcadores como [Su nombre] o [nombre del hotel].
- Usa un tono cordial, profesional y natural.
- No inventes datos adicionales.
- Máximo 2 o 3 frases.
- Escribe en español.
- No uses formato de carta (sin "Estimado huésped" si no es necesario, y sin "Saludos cordiales").
- Haz que suene natural como un mensaje de chat.

Ejemplo:
"La hora de check-out es a las 10:00 a.m. Gracias por su estancia y quedamos atentos a cualquier consulta."
  `;

  return await ask(prompt);
}

module.exports = { ask, getFriendlyResponse };
