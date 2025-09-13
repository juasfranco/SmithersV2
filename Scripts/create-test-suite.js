// scripts/create-test-suite.js
async function createTestSuite() {
  console.log('🧪 Creating test suite...');
  
  const testFiles = {
    'tests/unit/domain/entities/Conversation.test.js': `
const { Conversation } = require('../../../../src/domain/entities/Conversation');

describe('Conversation Entity', () => {
  test('should create conversation with valid data', () => {
    const conversation = new Conversation({ guestId: 'test-123' });
    
    expect(conversation.guestId).toBe('test-123');
    expect(conversation.messages).toEqual([]);
    expect(conversation.summary.totalMessages).toBe(0);
  });

  test('should add message correctly', () => {
    const conversation = new Conversation({ guestId: 'test-123' });
    
    conversation.addMessage('guest', 'Hello');
    
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].role).toBe('guest');
    expect(conversation.messages[0].content).toBe('Hello');
  });

  test('should validate guest ID', () => {
    expect(() => new Conversation({ guestId: '' }))
      .toThrow('GuestId is required');
  });

  test('should trim messages when exceeding limit', () => {
    const conversation = new Conversation({ guestId: 'test-123' });
    
    // Add 55 messages (over the 50 limit)
    for (let i = 0; i < 55; i++) {
      conversation.addMessage('guest', \`Message \${i}\`);
    }
    
    expect(conversation.messages).toHaveLength(50);
    expect(conversation.messages[0].content).toBe('Message 5'); // First 5 trimmed
  });
});
    `,
    'tests/integration/webhook.test.js': `
const request = require('supertest');
const Server = require('../../src/server');

describe('Webhook Integration', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = new Server();
    await server.initialize();
    app = server.app;
  });

  afterAll(async () => {
    await server.shutdown();
  });

  test('should handle valid webhook payload', async () => {
    const payload = {
      event: 'new message received',
      reservationId: '123',
      message: 'Test message'
    };

    const response = await request(app)
      .post('/webhooks/hostaway')
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  test('should reject invalid webhook payload', async () => {
    const payload = {
      event: 'new message received'
      // missing required fields
    };

    await request(app)
      .post('/webhooks/hostaway')
      .send(payload)
      .expect(400);
  });
});
    `,
    'tests/setup.js': `
// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock external services in tests
jest.mock('../src/infrastructure/external/hostaway/HostawayService');
jest.mock('../src/infrastructure/external/openai/OpenAIService');

// Global test timeout
jest.setTimeout(30000);
    `
  };

  const jestConfig = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/**/*.test.js',
      '!src/server.js'
    ],
    testMatch: [
      '<rootDir>/tests/**/*.test.js'
    ],
    verbose: true
  };

  // Create test files
  for (const [filePath, content] of Object.entries(testFiles)) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content.trim());
    console.log(`  ✓ Created ${filePath}`);
  }

  // Create Jest configuration
  await fs.writeFile('jest.config.js', `module.exports = ${JSON.stringify(jestConfig, null, 2)};`);
  console.log('  ✓ Created jest.config.js');

  // Create test environment file
  const testEnv = `
# Test Environment Variables
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/smithers_test
OPENAI_API_KEY=test-key
HOSTAWAY_ACCOUNT_ID=test-account
HOSTAWAY_CLIENT_SECRET=test-secret
LOG_LEVEL=error
  `.trim();

  await fs.writeFile('.env.test', testEnv);
  console.log('  ✓ Created .env.test');

  console.log('✅ Test suite created');
  console.log('📋 Run tests with: npm test');
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--create-tests')) {
    createTestSuite().catch(console.error);
  } else {
    const migration = new CleanArchitectureMigration();
    migration.execute().catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
  }
}

module.exports = { CleanArchitectureMigration, createTestSuite };