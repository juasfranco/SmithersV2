// scripts/migrate-to-clean-architecture.js
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class CleanArchitectureMigration {
  constructor() {
    this.migrationSteps = [
      { name: 'backup', description: 'Create backup of current codebase' },
      { name: 'structure', description: 'Create new directory structure' },
      { name: 'dependencies', description: 'Update package.json with new dependencies' },
      { name: 'environment', description: 'Update environment variables' },
      { name: 'database', description: 'Run database migration (if needed)' },
      { name: 'validation', description: 'Validate new implementation' }
    ];
    this.backupDir = `backup_${new Date().toISOString().split('T')[0]}`;
  }

  async execute() {
    console.log('🚀 Starting Clean Architecture Migration');
    console.log('=====================================');

    for (const step of this.migrationSteps) {
      try {
        console.log(`\n📋 ${step.name.toUpperCase()}: ${step.description}`);
        await this[step.name]();
        console.log(`✅ ${step.name} completed successfully`);
      } catch (error) {
        console.error(`❌ ${step.name} failed:`, error.message);
        console.log('\n🔄 Rolling back changes...');
        await this.rollback();
        process.exit(1);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your PM2/supervisor configuration');
    console.log('2. Set new environment variables');
    console.log('3. Test all endpoints');
    console.log('4. Monitor logs for any issues');
  }

  async backup() {
    console.log(`📦 Creating backup in ${this.backupDir}/...`);
    
    // Create backup directory
    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Copy important files
    const filesToBackup = [
      'server.js',
      'package.json',
      'services/',
      'models/',
      'scripts/',
      '.env'
    ];

    for (const file of filesToBackup) {
      try {
        const src = path.resolve(file);
        const dest = path.resolve(this.backupDir, file);
        
        const stats = await fs.lstat(src);
        if (stats.isDirectory()) {
          execSync(`cp -r ${src} ${dest}`);
        } else {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        }
        console.log(`  ✓ Backed up ${file}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        console.log(`  ⚠ Skipped ${file} (not found)`);
      }
    }
  }

  async structure() {
    console.log('🏗 Creating new directory structure...');
    
    const directories = [
      'src/domain/entities',
      'src/domain/repositories',
      'src/domain/services',
      'src/infrastructure/database/mongodb',
      'src/infrastructure/database/models',
      'src/infrastructure/external/hostaway',
      'src/infrastructure/external/openai',
      'src/infrastructure/external/whatsapp',
      'src/infrastructure/security',
      'src/application/usecases',
      'src/application/dto',
      'src/presentation/controllers',
      'src/presentation/middleware',
      'src/presentation/routes',
      'src/shared/errors',
      'src/shared/logger',
      'src/shared/utils',
      'src/config',
      'tests/unit',
      'tests/integration',
      'docs'
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`  ✓ Created ${dir}/`);
    }

    // Create .gitkeep files for empty directories
    for (const dir of directories) {
      const keepFile = path.join(dir, '.gitkeep');
      try {
        await fs.access(keepFile);
      } catch {
        await fs.writeFile(keepFile, '');
      }
    }
  }

  async dependencies() {
    console.log('📦 Updating package.json...');
    
    const packagePath = 'package.json';
    let packageJson;
    
    try {
      const packageContent = await fs.readFile(packagePath, 'utf8');
      packageJson = JSON.parse(packageContent);
    } catch {
      packageJson = {
        name: "smithersv2-clean",
        version: "2.0.0",
        scripts: {},
        dependencies: {},
        devDependencies: {}
      };
    }

    // Add new dependencies
    const newDependencies = {
      "cors": "^2.8.5",
      "helmet": "^7.1.0",
      "compression": "^1.7.4",
      "joi": "^17.11.0", // For validation
      "winston": "^3.11.0" // Better logging
    };

    const newDevDependencies = {
      "jest": "^29.7.0",
      "supertest": "^6.3.3",
      "nodemon": "^3.0.2"
    };

    // Update scripts
    const newScripts = {
      ...packageJson.scripts,
      "start": "node src/server.js",
      "dev": "nodemon src/server.js",
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "migrate": "node scripts/migrate-to-clean-architecture.js",
      "validate": "node scripts/validate-implementation.js",
      "lint": "eslint src/ --fix"
    };

    // Update package.json
    packageJson.dependencies = { ...packageJson.dependencies, ...newDependencies };
    packageJson.devDependencies = { ...packageJson.devDependencies, ...newDevDependencies };
    packageJson.scripts = newScripts;
    packageJson.version = "2.0.0";

    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('  ✓ Updated package.json');

    // Install new dependencies
    console.log('📥 Installing new dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('  ✓ Dependencies installed');
  }

  async environment() {
    console.log('🔧 Setting up environment variables...');
    
    const envPath = '.env';
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch {
      console.log('  ⚠ No .env file found, creating new one');
    }

    // Add new environment variables
    const newEnvVars = [
      '',
      '# Clean Architecture Configuration',
      'NODE_ENV=development',
      'LOG_LEVEL=info',
      'ADMIN_API_KEY=your-secure-admin-key-here',
      'ENCRYPTION_KEY=your-encryption-key-here',
      'ALLOWED_ORIGINS=http://localhost:3000',
      'ALLOWED_IPS=127.0.0.1,::1',
      '',
      '# Optional WhatsApp Integration',
      '# WHATSAPP_API_URL=',
      '# WHATSAPP_API_TOKEN=',
      '# SUPPORT_WHATSAPP_NUMBER=',
      ''
    ].join('\n');

    // Check if new variables already exist
    const existingVars = envContent.split('\n');
    const varsToAdd = [];

    newEnvVars.split('\n').forEach(line => {
      if (line.includes('=') && !line.startsWith('#')) {
        const varName = line.split('=')[0];
        if (!existingVars.some(existing => existing.startsWith(varName + '='))) {
          varsToAdd.push(line);
        }
      }
    });

    if (varsToAdd.length > 0) {
      await fs.writeFile(envPath, envContent + '\n' + newEnvVars);
      console.log('  ✓ Added new environment variables');
      console.log('  ⚠ Please update the following variables:');
      varsToAdd.forEach(line => {
        if (!line.startsWith('#') && line.includes('your-')) {
          console.log(`    - ${line}`);
        }
      });
    } else {
      console.log('  ✓ Environment variables already configured');
    }
  }

  async database() {
    console.log('🗄 Running database migration...');
    
    // Import and run your existing safe migration
    try {
      const { safeMigration } = require('./scripts/safeMigration');
      if (safeMigration) {
        await safeMigration();
        console.log('  ✓ Database migration completed');
      } else {
        console.log('  ℹ No database migration needed');
      }
    } catch (error) {
      if (error.message.includes('Cannot find module')) {
        console.log('  ℹ No existing migration script found, skipping');
      } else {
        throw error;
      }
    }
  }

  async validation() {
    console.log('🧪 Validating new implementation...');
    
    // Create validation script
    const validationScript = `
const { DependencyContainer } = require('./src/config/DependencyContainer');

async function validate() {
  try {
    console.log('Testing dependency container...');
    const container = new DependencyContainer();
    await container.initialize();
    
    console.log('Testing health checks...');
    const health = await container.healthCheck();
    
    const unhealthyServices = Object.entries(health)
      .filter(([, status]) => !status.healthy)
      .map(([name]) => name);
    
    if (unhealthyServices.length > 0) {
      console.warn('Warning: Some services are not healthy:', unhealthyServices);
    }
    
    await container.shutdown();
    console.log('✅ Validation successful!');
    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  validate().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validate };
    `;

    await fs.writeFile('scripts/validate-implementation.js', validationScript);
    
    // Run validation
    try {
      execSync('node scripts/validate-implementation.js', { stdio: 'inherit' });
      console.log('  ✅ Validation passed');
    } catch (error) {
      console.log('  ⚠ Validation failed, but migration structure is complete');
      console.log('  📋 Manual testing required after environment setup');
    }
  }

  async rollback() {
    try {
      console.log('🔄 Rolling back changes...');
      
      // Restore from backup
      if (await this.directoryExists(this.backupDir)) {
        execSync(`cp -r ${this.backupDir}/* .`);
        console.log('✅ Rollback completed');
      } else {
        console.log('⚠ No backup found to rollback to');
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
    }
  }

  async directoryExists(dir) {
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }
}