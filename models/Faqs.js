// models/Faqs.js - CORREGIDO SIN DUPLICACIÓN
const mongoose = require("mongoose");

const FaqsSchema = new mongoose.Schema({
  _id: Number,
  question: String,
  answer: String,
  category: String,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
});

// Especificar nombre exacto de colección
module.exports = mongoose.model("Faqs", FaqsSchema, "Faqs");