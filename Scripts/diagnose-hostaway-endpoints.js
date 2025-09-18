// Scripts/diagnose-hostaway-endpoints.js
console.log('🔍 Diagnosing Hostaway API endpoints...\n');

// Test the WebhookDto first
const { WebhookDto } = require('../src/application/dto/WebhookDto');

const hostawayPayload = {
  "id": 324463955,
  "accountId": 90044,
  "userId": null,
  "listingMapId": 234202,
  "reservationId": 47773548,
  "conversationId": 34132494,
  "body": "Hola me podrias indicar la hora del check in porfavor",
  "isIncoming": 1,
  "isSeen": 0,
  "sentUsingHostaway": 0,
  "date": "2025-09-18 19:17:07",
  "status": "sent",
  "listingName": "Flat in the middle of Kreuzberg for 13",
  "communicationType": "email"
};

console.log('1. Testing WebhookDto...');
try {
  const dto = new WebhookDto(hostawayPayload);
  console.log(`   Event extracted: "${dto.event}"`);
  console.log(`   Should be: "new message received"`);
  console.log(`   isIncoming: ${hostawayPayload.isIncoming}`);
  console.log(`   body exists: ${!!hostawayPayload.body}`);
  
  if (dto.event === 'unknown') {
    console.log('   ❌ CRITICAL: WebhookDto is not working correctly!');
    
    // Debug the extractEvent function
    console.log('   🔧 Debugging extractEvent logic:');
    console.log(`      data.event: ${hostawayPayload.event} (undefined)`);
    console.log(`      data.isIncoming === 1: ${hostawayPayload.isIncoming === 1}`);
    console.log(`      data.body exists: ${!!hostawayPayload.body}`);
    console.log(`      data.message exists: ${!!hostawayPayload.message}`);
  } else {
    console.log('   ✅ WebhookDto working correctly');
  }
} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
}

console.log('\n2. Hostaway API endpoint analysis...');
console.log('   Current endpoint: POST /reservations/{id}/messages');
console.log('   Payload: { message: "text", type: "host_to_guest" }');
console.log('   Error: HTTP 404: Resource not found');
console.log('');
console.log('   Possible issues:');
console.log('   - Endpoint might be /conversations/{conversationId}/messages');
console.log('   - Endpoint might be /messages (with reservationId in body)');
console.log('   - Wrong payload structure');
console.log('   - Wrong authentication');

console.log('\n3. Field detection analysis...');
console.log('   Question: "Hola me podrias indicar la hora del check in porfavor"');
console.log('   Expected field: checkIn, checkInTime, or similar');
console.log('   Detected field: "unknown"');
console.log('   Issue: Keyword detection not working properly');

console.log('\n📋 Prioritized fixes needed:');
console.log('   1. 🚨 URGENT: Fix WebhookDto event detection');
console.log('   2. 🚨 URGENT: Fix Hostaway API endpoint for sending messages');
console.log('   3. 📈 Medium: Improve field detection for check-in questions');
console.log('   4. 📈 Medium: Fix AI fallback to generate real responses');

console.log('\n🚀 Next steps:');
console.log('   1. Deploy current WebhookDto changes');
console.log('   2. Research correct Hostaway API endpoint');
console.log('   3. Test field detection logic');
console.log('   4. Improve AI service');