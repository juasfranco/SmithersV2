const Faqs = require("../models/Faqs");
const gptService = require("./gptService");

async function searchFAQ(question) {
  const Faqs = await Faq.find({}).lean();
  if (!Faqs.length) return null;

  const prompt = `
Faqs:
${Faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}

Pregunta del huésped: "${question}"
Responde con la mejor coincidencia si existe, si no responde "No encontrado".
  `;
  const answer = await gptService.ask(prompt);
  return answer.includes("No encontrado") ? null : answer;
}

module.exports = { searchFAQ };
