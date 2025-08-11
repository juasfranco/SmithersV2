const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  guestId: String,
  messages: [
    {
      role: { type: String, enum: ["guest", "agent"] },
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Conversation", ConversationSchema, "Conversation");
