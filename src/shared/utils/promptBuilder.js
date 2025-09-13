function buildPrompt({ faqs, history, guestQuestion, listingInfo = null }) {
  const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n");
  const historyText = history.map(m => `${m.sender}: ${m.message}`).join("\n");
  const listingText = listingInfo
    ? `Property Information:\n${Object.entries(listingInfo).map(([k, v]) => `${k}: ${v}`).join("\n")}`
    : "";

  return `
You are a helpful AI assistant for a short-term rental company.
Answer the guest's question based on the FAQs, conversation history, and property info.

FAQs:
${faqText}

Conversation History:
${historyText}

${listingText}

Guest's question:
${guestQuestion}
`;
}
module.exports = { buildPrompt };

