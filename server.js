require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const { getAllFaqs } = require("./services/faqService");
const { getConversationHistory, saveMessage } = require("./services/conversationService");
const { askGpt } = require("./services/gptService");
const { buildPrompt } = require("./utils/promptBuilder");
const { sendMessageToGuest } = require("./services/hostawayService");
const { getListingById } = require("./services/hostawayListingService");


const app = express();
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.error("❌ Error MongoDB:", err));

// Webhook endpoint
app.post("/webhooks/hostaway", async (req, res) => {
  const { event, data } = req.body;
  if (event !== "messageCreated") return res.sendStatus(200);

  const { guestId, message, reservationId, listingId } = data;

  const faqs = await getAllFaqs();
  const history = await getConversationHistory(guestId);
  const listingInfo = await getListingById(listingId); // <-- clave aquí

  const prompt = buildPrompt({ faqs, history, guestQuestion: message, listingInfo });
  const response = await askGpt(prompt);

  await sendMessageToGuest(reservationId, response);
  await saveMessage(guestId, "guest", message);
  await saveMessage(guestId, "agent", response);

  res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Webhook active on port: ${process.env.PORT}`);
});
