const Faq = require("../models/faq");

async function getAllFaqs() {
  return await Faq.find({});
}

module.exports = { getAllFaqs };
