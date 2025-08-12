// services/faqService.js - ACTUALIZADO para trabajar con tu estructura de FAQs
const Faqs = require("../models/Faqs");
const gptService = require("./gptService");

async function searchFAQ(question, conversationHistory = []) {
  try {
    console.log("📚 Buscando en FAQs existentes...");
    
    // 🔹 OBTENER TUS FAQs existentes (respeta tu estructura)
    const faqs = await Faqs.find({}).lean();
    console.log(`📖 Encontradas ${faqs.length} FAQs en la base de datos`);
    
    if (!faqs.length) return null;

    // Crear contexto con historial si está disponible
    const contextualQuestion = conversationHistory.length > 0 
      ? `Contexto previo:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: ${question}`
      : question;

    // 🔹 FORMATO específico para tus FAQs
    const faqsText = faqs.map(f => {
      // Manejar tanto tu estructura existente como posibles variaciones
      const faqQuestion = f.question || f.Question || f.q;
      const faqAnswer = f.answer || f.Answer || f.a;
      return `Q: ${faqQuestion}\nA: ${faqAnswer}`;
    }).join("\n\n");

    const prompt = `
FAQs disponibles:
${faqsText}

Consulta del huésped: "${contextualQuestion}"

Instrucciones:
1. Busca la FAQ que mejor responda a la pregunta
2. Si hay contexto de conversación previa, úsalo para dar una respuesta más precisa
3. Considera sinónimos y variaciones de la pregunta
4. Si encuentras una respuesta relevante, devuélvela tal como está en la FAQ
5. Si no hay ninguna FAQ relevante, responde exactamente: "No encontrado"

Respuesta:
    `;
    
    const answer = await gptService.ask(prompt);
    
    if (answer.includes("No encontrado")) {
      console.log("❌ No se encontró FAQ relevante");
      return null;
    }
    
    console.log("✅ FAQ encontrada y devuelta");
    return answer;
    
  } catch (error) {
    console.error("❌ Error en searchFAQ:", error);
    return null;
  }
}

module.exports = { 
  searchFAQ
};