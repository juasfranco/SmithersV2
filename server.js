require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const { getAgentResponse } = require("./services/conversationService");
const { sendMessageToGuest } = require("./services/hostawayService");

const app = express();
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB, 🔗 Conectado a: ", mongoose.connection.name))
  .catch(err => console.error("❌ Error MongoDB:", err));

// Webhook endpoint
app.post("/webhooks/hostaway", async (req, res) => {
  const { event, data } = req.body;
  if (event !== "messageCreated") return res.sendStatus(200);

  const guestId = data.guestId;
  const message = data.message;
  const reservationId = data.reservationId;
  const listingMapId = Number(data.ListingMapId);


  console.log("📌 Listing ID recibido:", listingMapId);

  // 🔹 Usamos el nuevo flujo inteligente
  const response = await getAgentResponse(message, listingMapId);

  await sendMessageToGuest(reservationId, response);

  res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Webhook active on port: ${process.env.PORT}`);
});
