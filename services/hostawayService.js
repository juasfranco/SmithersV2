const axios = require("axios");
require("dotenv").config();

async function sendMessageToGuest(reservationId, message) {
  await axios.post(
    "https://api.hostaway.com/v1/messages",
    {
      reservationId,
      message
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HOSTAWAY_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
}

module.exports = { sendMessageToGuest };
