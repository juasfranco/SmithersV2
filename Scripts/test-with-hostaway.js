#!/usr/bin/env node
/**
 * Script para probar webhooks de Hostaway en desarrollo local
 * Usa ngrok para crear un túnel público hacia tu servidor local
 */

const { spawn } = require('child_process');
const { SecureLogger } = require('../src/shared/logger/SecureLogger');

class HostawayTestRunner {
  constructor() {
    this.logger = new SecureLogger();
    this.serverProcess = null;
    this.ngrokProcess = null;
    this.ngrokUrl = null;
  }

  async start() {
    try {
      this.logger.info('🚀 Starting Hostaway webhook testing environment...');

      // 1. Start the server
      await this.startServer();
      
      // 2. Wait a bit for server to be ready
      await this.delay(3000);
      
      // 3. Start ngrok tunnel
      await this.startNgrok();
      
      // 4. Show instructions
      this.showInstructions();

      // 5. Handle cleanup
      this.setupCleanup();

    } catch (error) {
      this.logger.error('Failed to start test environment', { error: error.message });
      await this.cleanup();
      process.exit(1);
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.logger.info('Starting Smithers server...');
      
      this.serverProcess = spawn('node', ['server.js'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let output = '';

      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
        
        if (output.includes('server started successfully')) {
          this.logger.info('✅ Server is ready!');
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      this.serverProcess.on('error', (error) => {
        this.logger.error('Server process error', { error: error.message });
        reject(error);
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0) {
          this.logger.error('Server exited with code', { code });
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }

  async startNgrok() {
    return new Promise((resolve, reject) => {
      this.logger.info('Starting ngrok tunnel...');
      
      this.ngrokProcess = spawn('ngrok', ['http', '3000', '--log=stdout'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let urlFound = false;

      this.ngrokProcess.stdout.on('data', (data) => {
        output += data.toString();
        
        // Look for the public URL
        const urlMatch = output.match(/url=https:\/\/[a-zA-Z0-9-]+\.ngrok(-free)?\.app/);
        if (urlMatch && !urlFound) {
          this.ngrokUrl = urlMatch[0].replace('url=', '');
          urlFound = true;
          this.logger.info('✅ Ngrok tunnel established!', { url: this.ngrokUrl });
          resolve();
        }
      });

      this.ngrokProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('command failed')) {
          reject(new Error('Ngrok failed to start. Make sure ngrok is installed and accessible.'));
        }
      });

      this.ngrokProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!urlFound) {
          reject(new Error('Ngrok tunnel did not start within 30 seconds'));
        }
      }, 30000);
    });
  }

  showInstructions() {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 HOSTAWAY WEBHOOK TESTING ENVIRONMENT READY!');
    console.log('='.repeat(80));
    console.log('\n📍 Your public webhook URL:');
    console.log(`   ${this.ngrokUrl}/webhooks/hostaway`);
    console.log('\n🔧 How to configure in Hostaway:');
    console.log('   1. Go to your Hostaway account settings');
    console.log('   2. Navigate to Integration > Webhooks');
    console.log('   3. Add a new webhook with this URL:');
    console.log(`      ${this.ngrokUrl}/webhooks/hostaway`);
    console.log('   4. Select the events you want to test');
    console.log('   5. Save the webhook configuration');
    console.log('\n🧪 Available endpoints:');
    console.log(`   • Health Check: ${this.ngrokUrl}/health`);
    console.log(`   • Webhook: ${this.ngrokUrl}/webhooks/hostaway`);
    console.log(`   • Admin Stats: ${this.ngrokUrl}/api/admin/stats`);
    console.log(`   • Debug: ${this.ngrokUrl}/api/debug/conversations`);
    console.log('\n📊 Monitor your webhooks:');
    console.log('   • Check the console output for incoming requests');
    console.log('   • Use the debug endpoints to verify data processing');
    console.log('\n⚠️  Important Notes:');
    console.log('   • This URL is temporary and will change when you restart');
    console.log('   • Free ngrok URLs are rate-limited');
    console.log('   • For production, consider ngrok pro or deploy to a real server');
    console.log('\n🛑 To stop: Press Ctrl+C');
    console.log('='.repeat(80) + '\n');
  }

  setupCleanup() {
    const cleanup = async () => {
      console.log('\n🛑 Shutting down test environment...');
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', cleanup);
  }

  async cleanup() {
    try {
      if (this.ngrokProcess) {
        this.logger.info('Stopping ngrok...');
        this.ngrokProcess.kill('SIGTERM');
      }

      if (this.serverProcess) {
        this.logger.info('Stopping server...');
        this.serverProcess.kill('SIGTERM');
      }

      // Wait a bit for graceful shutdown
      await this.delay(2000);

      this.logger.info('✅ Cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new HostawayTestRunner();
  runner.start().catch(console.error);
}

module.exports = HostawayTestRunner;
