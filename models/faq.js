const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema({
  _id: Number,
  question: String,
  answer: String,
  category: String,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
});

module.exports = mongoose.model("Faq", faqSchema);
