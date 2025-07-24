const Conversation = require("../models/conversation");

async function getConversationHistory(guestId) {
  const conv = await Conversation.findOne({ guestId });
  return conv?.messages || [];
}

async function saveMessage(guestId, role, content) {
  const conv = await Conversation.findOneAndUpdate(
    { guestId },
    { $push: { messages: { role, content } } },
    { upsert: true, new: true }
  );
  return conv;
}

module.exports = { getConversationHistory, saveMessage };
