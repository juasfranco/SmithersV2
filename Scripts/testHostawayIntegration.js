// scripts/testHostawayIntegration.js 
require('dotenv').config();
const { DependencyContainer } = require('../src/config/DependencyContainer');
const { Environment } = require('../src/config/Environment');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');

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

module.exports = { testHostawayIntegration };
