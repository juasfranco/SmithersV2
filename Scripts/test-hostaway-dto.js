// Scripts/test-hostaway-dto.js
const { WebhookDto } = require('../src/application/dto/WebhookDto');

// Test with the actual Hostaway payload
const hostawayPayload = {
  "id": 324373955,
  "accountId": 90044,
  "userId": null,
  "listingMapId": 234202,
  "reservationId": 47773548,
  "conversationId": 34132494,
  "communicationId": null,
  "airbnbThreadMessageId": null,
  "channelId": null,
  "channelThreadMessageId": null,
  "body": "hola me puedes decir a que horas es el checkout",
  "imagesUrls": null,
  "bookingcomSubthreadId": null,
  "inReplyTo": null,
  "bookingcomReplyOptions": null,
  "bookingcomSelectedOptions": null,
  "isIncoming": 1,
  "isSeen": 0,
  "sentUsingHostaway": 0,
  "hash": "5be9f8b2e51f72a766b66ba4833f7e27",
  "listingTimeZoneName": "Europe/Berlin",
  "communicationEvent": null,
  "communicationTimeDelta": null,
  "communicationTimeDeltaSeconds": 0,
  "communicationApplyListingTimeZone": null,
  "communicationAlwaysTrigger": null,
  "date": "2025-09-18 15:44:33",
  "status": "sent",
  "sentChannelDate": null,
  "listingName": "Flat in the middle of Kreuzberg for 13",
  "attachments": [],
  "insertedOn": "2025-09-18 15:44:33",
  "updatedOn": "2025-09-18 15:44:33",
  "communicationType": "email"
};

console.log('🧪 Testing WebhookDto with real Hostaway payload...\n');

try {
  const dto = new WebhookDto(hostawayPayload);
  
  console.log('✅ WebhookDto created successfully!');
  console.log('📋 Extracted fields:');
  console.log(`   Event: ${dto.event}`);
  console.log(`   Reservation ID: ${dto.reservationId}`);
  console.log(`   Conversation ID: ${dto.conversationId}`);
  console.log(`   Message ID: ${dto.messageId}`);
  console.log(`   Message: ${dto.message}`);
  console.log(`   Guest ID: ${dto.guestId}`);
  console.log(`   Listing Map ID: ${dto.listingMapId}`);
  
  const validation = dto.validate();
  console.log(`\n📝 Validation: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`);
  if (!validation.isValid) {
    console.log('   Errors:', validation.errors);
  }
  
} catch (error) {
  console.log('❌ Error creating WebhookDto:', error.message);
}