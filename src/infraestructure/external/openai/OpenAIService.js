// src/infraestructure/external/openai/OpenAIService.js
const { OpenAI } = require('openai');
const { SecureLogger } = require('../../../shared/logger/SecureLogger');

class OpenAIService {
  constructor({ apiKey }) {
    this.openai = new OpenAI({ apiKey });
    this.logger = new SecureLogger();
  }

  async ask(prompt, options = {}) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.4,
        max_tokens: options.maxTokens || 2000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      this.logger.error('OpenAI API error', { error: error.message });
      throw error;
    }
  }

  async detectField(message, conversationHistory = []) {
    const contextPrompt = conversationHistory.length > 0
      ? `Historial de conversación reciente:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: "${message}"`
      : `Pregunta: "${message}"`;

    const prompt = `
Contexto de conversación:
${contextPrompt}

Identifica el campo específico que el usuario está preguntando.
Devuelve SOLO el nombre del campo en inglés tal como se usaría en la base de datos (ej: checkOutTime, checkInTime, wifi, parking, address).
Si no puedes identificar un campo específico, responde "unknown".
    `;

    const response = await this.ask(prompt);
    return response.trim().split(/[\n,.;:]/)[0].trim();
  }

  async generateFriendlyResponse(question, answer, conversationHistory = []) {
    const prompt = `
Genera una respuesta breve, amable y personalizada para un huésped,
usando el siguiente dato como respuesta principal:

Pregunta: "${question}"
Dato: "${answer}"

${conversationHistory.length > 0 ? `Contexto de conversación previa:\n${conversationHistory.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}` : ''}

Reglas:
- No uses plantillas ni marcadores como [Su nombre] o [nombre del hotel].
- Usa un tono cordial, profesional y natural.
- No inventes datos adicionales.
- Máximo 2 o 3 frases.
- Escribe en español.
- Haz que suene natural como un mensaje de chat.

Ejemplo:
"La hora de check-out es a las 10:00 a.m. Gracias por su estancia y quedamos atentos a cualquier consulta."
    `;

    return await this.ask(prompt);
  }

  async generateFallbackResponse(message, conversationHistory = [], context = null) {
    const contextInfo = context ? `
Información de contexto disponible:
- Huésped: ${context.reservation?.guestName || 'No disponible'}
- Propiedad: ${context.listing?.name || 'No disponible'}
- Check-in: ${context.reservation?.checkInDate || 'No disponible'}
` : '';

    const prompt = `
Eres un asistente amable y profesional para huéspedes de alojamientos.
${conversationHistory.length > 0 ? `Contexto de conversación previa:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n` : ''}
${contextInfo}
Pregunta actual: "${message}"

No tienes información específica sobre este tema en la base de datos.
Responde de manera útil pero indica que necesitas verificar la información o que el huésped puede contactar directamente al anfitrión.
Mantén un tono cordial y profesional.
    `;

    return await this.ask(prompt);
  }

  async searchFAQs(question, faqsText) {
    const prompt = `
FAQs disponibles:
${faqsText}

Consulta del huésped: "${question}"

Instrucciones:
1. Busca la FAQ que mejor responda a la pregunta
2. Considera sinónimos y variaciones de la pregunta
3. Si encuentras una respuesta relevante, devuélvela tal como está en la FAQ
4. Si no hay ninguna FAQ relevante, responde exactamente: "No encontrado"

Respuesta:
    `;

    const answer = await this.ask(prompt);
    
    if (answer.includes("No encontrado")) {
      return null;
    }
    
    return answer;
  }

  async healthCheck() {
    try {
      await this.ask('Test connection', { maxTokens: 10 });
      return { healthy: true, status: 'connected' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  // Shutdown method
  shutdown() {
    this.logger.info('OpenAI service shutdown');
    // No specific cleanup needed for OpenAI client
  }
}


module.exports = { OpenAIService };