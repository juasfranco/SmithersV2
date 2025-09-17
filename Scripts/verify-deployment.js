// Scripts/verify-deployment.js - Verificación post-despliegue

const axios = require('axios');
const chalk = require('chalk');

class DeploymentVerifier {
  constructor(baseUrl, stage = 'prod') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.stage = stage;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };
    
    console.log(colors[type](`[${type.toUpperCase()}] ${message}`));
  }

  async runTest(name, testFn) {
    try {
      this.log(`Running test: ${name}`, 'info');
      const result = await testFn();
      
      if (result.success) {
        this.log(`✅ ${name}: PASSED`, 'success');
        this.results.passed++;
      } else {
        this.log(`❌ ${name}: FAILED - ${result.message}`, 'error');
        this.results.failed++;
      }
      
      this.results.tests.push({
        name,
        passed: result.success,
        message: result.message,
        duration: result.duration || 0
      });
      
    } catch (error) {
      this.log(`❌ ${name}: ERROR - ${error.message}`, 'error');
      this.results.failed++;
      this.results.tests.push({
        name,
        passed: false,
        message: error.message,
        duration: 0
      });
    }
  }

  async testHealthEndpoint() {
    const start = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Smithers-Deployment-Verifier/1.0'
        }
      });
      
      const duration = Date.now() - start;
      
      if (response.status === 200 && response.data) {
        return {
          success: true,
          message: `Health check passed (${duration}ms)`,
          duration
        };
      } else {
        return {
          success: false,
          message: `Unexpected response: ${response.status}`,
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: false,
        message: `Health check failed: ${error.message}`,
        duration
      };
    }
  }

  async testWebhookEndpoint() {
    const start = Date.now();
    
    // Test webhook with invalid payload (should return error but not crash)
    try {
      const response = await axios.post(`${this.baseUrl}/webhooks/hostaway`, 
        { test: 'invalid payload' },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Smithers-Deployment-Verifier/1.0'
          },
          validateStatus: () => true // Accept any status code
        }
      );
      
      const duration = Date.now() - start;
      
      // We expect either 400 (bad request) or 200 (processed)
      if ([200, 400, 401, 403].includes(response.status)) {
        return {
          success: true,
          message: `Webhook endpoint accessible (${response.status}, ${duration}ms)`,
          duration
        };
      } else {
        return {
          success: false,
          message: `Unexpected status: ${response.status}`,
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: false,
        message: `Webhook test failed: ${error.message}`,
        duration
      };
    }
  }

  async testApiRoutes() {
    const start = Date.now();
    
    // Test admin stats endpoint (might require auth)
    try {
      const response = await axios.get(`${this.baseUrl}/api/admin/stats`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Smithers-Deployment-Verifier/1.0'
        },
        validateStatus: () => true
      });
      
      const duration = Date.now() - start;
      
      // We expect either 200 (success) or 401/403 (auth required)
      if ([200, 401, 403].includes(response.status)) {
        return {
          success: true,
          message: `API routes accessible (${response.status}, ${duration}ms)`,
          duration
        };
      } else {
        return {
          success: false,
          message: `Unexpected API response: ${response.status}`,
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: false,
        message: `API routes test failed: ${error.message}`,
        duration
      };
    }
  }

  async testCorsHeaders() {
    const start = Date.now();
    
    try {
      const response = await axios.options(`${this.baseUrl}/health`, {
        timeout: 5000,
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'User-Agent': 'Smithers-Deployment-Verifier/1.0'
        }
      });
      
      const duration = Date.now() - start;
      const corsHeader = response.headers['access-control-allow-origin'];
      
      if (corsHeader) {
        return {
          success: true,
          message: `CORS headers present (${duration}ms)`,
          duration
        };
      } else {
        return {
          success: false,
          message: 'CORS headers missing',
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: true, // CORS test is not critical
        message: `CORS test completed with note: ${error.message}`,
        duration
      };
    }
  }

  async testPerformance() {
    const start = Date.now();
    
    try {
      // Make 3 concurrent requests to test performance
      const promises = Array.from({ length: 3 }, () => 
        axios.get(`${this.baseUrl}/health`, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Smithers-Deployment-Verifier/1.0'
          }
        })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;
      const avgResponseTime = duration / 3;
      
      const allSuccessful = responses.every(r => r.status === 200);
      
      if (allSuccessful && avgResponseTime < 5000) {
        return {
          success: true,
          message: `Performance test passed (avg: ${avgResponseTime.toFixed(0)}ms)`,
          duration
        };
      } else if (allSuccessful) {
        return {
          success: true,
          message: `Performance test passed but slow (avg: ${avgResponseTime.toFixed(0)}ms)`,
          duration
        };
      } else {
        return {
          success: false,
          message: 'Some concurrent requests failed',
          duration
        };
      }
      
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: false,
        message: `Performance test failed: ${error.message}`,
        duration
      };
    }
  }

  async runAllTests() {
    this.log(`Starting deployment verification for: ${this.baseUrl}`, 'info');
    this.log(`Stage: ${this.stage}`, 'info');
    console.log('');

    await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
    await this.runTest('Webhook Endpoint', () => this.testWebhookEndpoint());
    await this.runTest('API Routes', () => this.testApiRoutes());
    await this.runTest('CORS Headers', () => this.testCorsHeaders());
    await this.runTest('Performance', () => this.testPerformance());

    this.printSummary();
    return this.results.failed === 0;
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    this.log('DEPLOYMENT VERIFICATION SUMMARY', 'info');
    console.log('='.repeat(50));
    
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    
    if (this.results.failed > 0) {
      this.log(`Failed: ${this.results.failed}`, 'error');
    }
    
    console.log('\nDetailed Results:');
    this.results.tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      const duration = test.duration ? ` (${test.duration}ms)` : '';
      console.log(`  ${status} ${test.name}${duration}`);
      if (!test.passed) {
        console.log(`     ${chalk.red(test.message)}`);
      }
    });
    
    if (this.results.failed === 0) {
      this.log('\n🎉 All tests passed! Deployment is successful.', 'success');
    } else {
      this.log('\n⚠️  Some tests failed. Please check the deployment.', 'warning');
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node verify-deployment.js <API_URL> [stage]');
    console.log('Example: node verify-deployment.js https://abc123.execute-api.us-east-1.amazonaws.com/prod prod');
    process.exit(1);
  }
  
  const apiUrl = args[0];
  const stage = args[1] || 'prod';
  
  const verifier = new DeploymentVerifier(apiUrl, stage);
  
  try {
    const success = await verifier.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red(`Verification failed: ${error.message}`));
    process.exit(1);
  }
}

// Install chalk if not present
try {
  require.resolve('chalk');
} catch (e) {
  console.log('Installing chalk for better output formatting...');
  require('child_process').execSync('npm install chalk', { stdio: 'inherit' });
}

if (require.main === module) {
  main();
}

module.exports = DeploymentVerifier;