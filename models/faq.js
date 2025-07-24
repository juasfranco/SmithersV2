const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
  question: String,
  answer: String,
  tags: [String]
});

module.exports = mongoose.model("Faq", faqSchema);
