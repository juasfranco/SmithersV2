// scripts/testHostawayIntegration.js 
require('dotenv').config();
const { DependencyContainer } = require('../src/config/DependencyContainer');
const { Environment } = require('../src/config/Environment');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');
const { ProcessWebhookUseCase } = require('../src/application/usecases/ProcessWebhookUseCase');

const logger = new SecureLogger();

async function testHostawayIntegration() {
  console.log('� Starting Hostaway Integration Test...\n');
  
  try {
    // 1. Environment Variables Check
    console.log('� Checking environment variables...');
    const requiredVars = ['HOSTAWAY_ACCOUNT_ID', 'HOSTAWAY_CLIENT_SECRET'];
    
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      console.log(`   ${varName}: ${value ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
      
      if (!value) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    });

    // 2. Initialize Container
    console.log('\n🔧 Initializing dependency container...');
    const container = new DependencyContainer();
    await container.initialize();
    
    // 3. Get Hostaway Service
    const hostawayService = container.get('hostawayService');
    
    if (!hostawayService) {
      throw new Error('Failed to get Hostaway service from container');
    }

    // 4. Test Authentication
    console.log('\n🔑 Testing authentication...');
    const token = await hostawayService.getAccessToken();
    console.log(`✅ Token obtained: ${token.substring(0, 30)}...`);

    // 5. Test Basic Connection
    console.log('\n🌐 Testing basic connection...');
    const connectionTest = await hostawayService.testConnection();
    
    if (!connectionTest) {
      throw new Error('Basic connection test failed');
    }
    console.log('✅ Connection test successful');

    // 6. Test Listings API
    console.log('\n📋 Testing listings API...');
    try {
      const response = await hostawayService.apiRequest('GET', '/listings?limit=1');
      console.log('✅ Listings API functional. Example listing:', {
        id: response?.result?.[0]?.id,
        name: response?.result?.[0]?.name,
        status: response?.result?.[0]?.status
      });
    } catch (error) {
      console.error('❌ Failed to fetch listings:', error.message);
      throw error;
    }

    // 7. Test Reservations API
    console.log('\n🏠 Testing reservations API...');
    try {
      const response = await hostawayService.apiRequest('GET', '/reservations?limit=1&includeResources=1');
      if (response?.result?.length > 0) {
        const reservation = response.result[0];
        console.log('✅ Reservations API functional. Example reservation:', {
          id: reservation.id,
          guestName: reservation.guestName,
          status: reservation.status,
          checkIn: reservation.arrivalDate,
          checkOut: reservation.departureDate
        });

        // 8. Test Complete Context
        console.log('\n🔍 Testing complete context retrieval...');
        const context = await hostawayService.getCompleteContext(reservation.id);
        console.log('✅ Complete context retrieved successfully:', {
          reservationId: context.reservation.id,
          listingId: context.listing?.id,
          guestName: context.reservation.guestName,
          hasMessages: Array.isArray(context.messages)
        });
      } else {
        console.warn('⚠️ No reservations found for testing');
      }
    } catch (error) {
      console.error('❌ Failed to test reservations:', error.message);
      throw error;
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    process.exit(0);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testHostawayIntegration().catch(error => {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  });
}

async function testWebhookProcessing(container) {
  console.log('\n🎣 Testing webhook processing...');
  
  // Mock webhook data
  const mockWebhookData = {
    reservationId: '123456',
    conversationId: 'conv-789',
    messageId: 'msg-456',
    message: 'What time is check-in?',
    messageType: 'inquiry',
    guestId: 'guest-test-123',
    listingMapId: 789
  };
  
  try {
    console.log('📨 Simulating webhook "new message received"...');
    
    const webhookUseCase = container.get('processWebhookUseCase');
    
    // This will fail because the reservation doesn't exist, but it tests the flow
    try {
      await webhookUseCase.execute('new_message', mockWebhookData);
      console.log('✅ Webhook processed successfully');
    } catch (error) {
      if (error.message.includes('Reservation not found')) {
        console.log('⚠️ Webhook processed correctly until reservation lookup (expected for test data)');
        return true;
      }
      throw error;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error.message);
    return false;
  }
}

async function testFullFlow(container) {
  console.log('\n🔄 Testing complete flow with real reservation...');
  
  try {
    const hostawayService = container.get('hostawayService');
    
    // Get a real reservation to test
    const response = await hostawayService.apiRequest('GET', '/reservations?limit=1&includeResources=1');
    
    if (!response?.result?.length) {
      console.log('⚠️ No reservations available for full flow test');
      return false;
    }
    
    const reservation = response.result[0];
    console.log(`📋 Using reservation ${reservation.id} for complete test...`);
    
    // Simulate webhook with real reservation
    const realWebhookData = {
      reservationId: reservation.id,
      conversationId: reservation.conversationId || null,
      message: 'This is a virtual agent test. Is the integration working?',
      messageType: 'inquiry',
      guestId: reservation.guestEmail || `guest-${reservation.id}`,
      listingMapId: reservation.listingMapId
    };
    
    console.log('🤖 Processing with virtual agent...');
    const webhookUseCase = container.get('processWebhookUseCase');
    const startTime = Date.now();
    const result = await webhookUseCase.execute('new_message', realWebhookData);
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Full flow successful:', {
      success: true,
      processingTime: `${processingTime}ms`,
      guestName: result?.guestName || 'Not available'
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in full flow:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 STARTING HOSTAWAY INTEGRATION TESTS\n');
  console.log('='.repeat(50));
  
  const results = {
    connection: false,
    webhook: false,
    fullFlow: false
  };
  
  let container;
  
  try {
    // Initialize container once for all tests
    container = new DependencyContainer();
    await container.initialize();
    
    // Test 1: Basic Connection
    console.log('1️⃣ CONNECTION TEST');
    results.connection = await testHostawayIntegration();
    
    // Test 2: Webhook Processing
    console.log('\n2️⃣ WEBHOOK TEST');
    results.webhook = await testWebhookProcessing(container);
    
    // Test 3: Full Flow (only if connection worked)
    if (results.connection) {
      console.log('\n3️⃣ FULL FLOW TEST');
      results.fullFlow = await testFullFlow(container);
    }
    
    // Final Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY:');
    console.log(`✅ Hostaway Connection: ${results.connection ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Webhook Processing: ${results.webhook ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Full Flow: ${results.fullFlow ? 'SUCCESS' : 'FAILED'}`);
    
    if (results.connection && results.webhook) {
      console.log('\n🎉 Hostaway integration ready to use!');
      console.log('\n📋 Next steps:');
      console.log('1. Configure your webhook in Hostaway Dashboard');
      console.log('2. Point webhook to: your-server.com/webhooks/hostaway');
      console.log('3. Test by sending real messages from Hostaway');
    } else {
      console.log('\n⚠️ There are integration issues. Check:');
      console.log('1. Environment variables HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET');
      console.log('2. API permissions in your Hostaway account');
      console.log('3. Internet connection');
    }
    
  } catch (error) {
    console.error('\n💥 Critical test error:', error.message);
    process.exit(1);
  } finally {
    if (container) {
      await container.shutdown();
    }
    console.log('\n🔚 Tests completed');
    process.exit(results.connection && results.webhook ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Critical test error:', error);
    process.exit(1);
  });
}

module.exports = { 
  testHostawayIntegration, 
  testWebhookProcessing, 
  testFullFlow,
  runAllTests 
};
