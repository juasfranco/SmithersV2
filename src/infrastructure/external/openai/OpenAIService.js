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

  async detectField(input) {
    const { message, context = [], fields = [] } = input;

    const contextPrompt = context.length > 0
      ? `Historial de conversación reciente:\n${context.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: "${message}"`
      : `Pregunta: "${message}"`;

    const fieldsPrompt = fields.length > 0
      ? `\nCampos disponibles: ${fields.join(', ')}`
      : '';

    const prompt = `
Contexto de conversación:
${contextPrompt}
${fieldsPrompt}

Tu tarea es identificar el campo específico que el usuario está preguntando.

Ejemplos de mapeo:
- "¿A qué hora es el check in?" → checkInTime
- "¿Cuál es la hora de entrada?" → checkInTime
- "¿A qué hora puedo llegar?" → checkInTime
- "¿A qué hora es el check out?" → checkOutTime
- "¿Cuál es la hora de salida?" → checkOutTime
- "¿Hasta qué hora puedo quedarme?" → checkOutTime
- "¿Hay wifi?" → wifi
- "¿Dónde puedo aparcar?" → parking
- "¿Cuál es la dirección?" → address
- "¿Hay desayuno?" → breakfast

Analiza la pregunta y devuelve SOLO el nombre del campo más apropiado.
Si no coincide con ningún campo específico, responde "unknown".
`;

    try {
      const response = await this.ask(prompt);
      const detectedField = response.trim().split(/[\n,.;:]/)[0].trim();
      
      this.logger.debug('Field detection result', {
        originalMessage: message,
        detectedField,
        availableFields: fields
      });
      
      return detectedField;
    } catch (error) {
      this.logger.error('Error detecting field', { error: error.message, message });
      return 'unknown';
    }
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

Analiza la pregunta y responde de manera útil:

Si pregunta sobre horarios de check-in/check-out:
- Proporciona horarios estándar comunes (check-in: 15:00, check-out: 11:00)
- Menciona que puede verificar la información específica de su reserva
- Sugiere contactar al anfitrión para casos especiales

Si pregunta sobre otros temas (wifi, dirección, amenidades):
- Da una respuesta general útil
- Indica que puedes obtener información más específica
- Sugiere contactar al anfitrión para detalles exactos

Mantén un tono cordial y profesional. Responde en español.
Máximo 3 frases.
    `;

    try {
      const response = await this.ask(prompt);
      
      this.logger.debug('Fallback response generated', {
        originalMessage: message,
        responseLength: response?.length || 0
      });
      
      return response;
    } catch (error) {
      this.logger.error('Error generating fallback response', { 
        error: error.message, 
        message 
      });
      
      // Emergency fallback
      if (message.toLowerCase().includes('check') && (message.toLowerCase().includes('in') || message.toLowerCase().includes('entrada'))) {
        return 'El horario de check-in generalmente es a las 15:00 horas. Te recomiendo verificar los detalles específicos de tu reserva o contactar a tu anfitrión para confirmar.';
      } else if (message.toLowerCase().includes('check') && (message.toLowerCase().includes('out') || message.toLowerCase().includes('salida'))) {
        return 'El horario de check-out generalmente es a las 11:00 horas. Te sugiero revisar tu confirmación de reserva o contactar a tu anfitrión para cualquier arreglo especial.';
      } else {
        return 'Disculpa, necesito verificar esta información específica. Te recomiendo contactar directamente a tu anfitrión quien podrá darte todos los detalles que necesitas.';
      }
    }
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