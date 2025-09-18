// Scripts/test-webhook-fix.js
const axios = require('axios');

async function testWebhookProcessing() {
  console.log('🧪 Testing webhook processing fixes...\n');

  const testCases = [
    {
      name: 'Standard Hostaway message webhook',
      payload: {
        event: 'messageCreated',
        reservationId: '12345',
        conversationId: 'conv_789',
        messageId: 'msg_456',
        message: 'Hello, I have a question about my reservation',
        guestId: 'guest_123',
        listingMapId: 'listing_456'
      }
    },
    {
      name: 'Alternative format webhook',
      payload: {
        event: 'conversation_message_created',
        data: {
          reservationId: '12345',
          conversationId: 'conv_789',
          message: 'This is another message format'
        }
      }
    },
    {
      name: 'Snake_case format webhook',
      payload: {
        event: 'message_created',
        reservation_id: '12345',
        conversation_id: 'conv_789',
        message: 'Message with snake_case fields',
        guest_id: 'guest_123'
      }
    },
    {
      name: 'Unknown event with message data',
      payload: {
        reservationId: '12345',
        message: 'This has no event field but has message data',
        guestId: 'guest_123'
      }
    },
    {
      name: 'Nested object format',
      payload: {
        event: 'new_message',
        object: {
          reservationId: '12345',
          message: 'Message in nested object',
          guestEmail: 'guest@example.com'
        }
      }
    }
  ];

  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';

  for (const testCase of testCases) {
    try {
      console.log(`📤 Testing: ${testCase.name}`);
      console.log(`   Payload: ${JSON.stringify(testCase.payload, null, 2)}`);
      
      const response = await axios.post(`${baseUrl}/webhooks/hostaway`, testCase.payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HostawayTestBot/1.0'
        },
        timeout: 10000
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📥 Response: ${JSON.stringify(response.data, null, 2)}\n`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   📥 Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      console.log('');
    }
  }
}

// Run the tests
testWebhookProcessing().catch(console.error);