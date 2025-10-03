#!/usr/bin/env node

/**
 * VPS Environment Check Script
 * Checks environment variables, file permissions, and system status
 */

const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

async function checkEnvironment() {
  console.log('🔍 VPS Environment Check');
  console.log('=' .repeat(40));

  // Check critical environment variables
  console.log('\n📋 Environment Variables:');
  const envVars = [
    'NODE_ENV',
    'NEWS_API_KEY',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];

  envVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅ Set' : '❌ Missing';
    const display = value ? `${value.substring(0, 10)}...` : 'N/A';
    console.log(`  ${status} ${varName}: ${display}`);
  });

  // Check file system permissions
  console.log('\n📁 File System Permissions:');

  const directories = [
    process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data'),
    '/var/log',
    '/var/repo'
  ];

  for (const dir of directories) {
    try {
      await fs.access(dir, fs.constants.W_OK);
      console.log(`  ✅ Writable: ${dir}`);
    } catch (error) {
      console.log(`  ❌ Not writable: ${dir} - ${error.message}`);
    }
  }

  // Check specific files
  const files = [
    '/tmp/processed-articles.json',
    path.join(process.cwd(), '.env'),
    '/var/repo/ai-news-app.git/hooks/post-receive'
  ];

  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      console.log(`  ✅ Exists: ${file} (${stats.size} bytes)`);
    } catch (error) {
      console.log(`  ❌ Missing: ${file} - ${error.message}`);
    }
  }

  // Check system resources
  console.log('\n💻 System Resources:');

  try {
    const uptime = execSync('uptime', { encoding: 'utf8' }).trim();
    console.log(`  ⏰ Uptime: ${uptime}`);

    const memory = execSync('free -h', { encoding: 'utf8' });
    const memLines = memory.split('\n');
    const memLine = memLines.find(line => line.startsWith('Mem:'));
    if (memLine) {
      console.log(`  💾 Memory: ${memLine.trim()}`);
    }

    const disk = execSync('df -h /', { encoding: 'utf8' });
    const diskLines = disk.split('\n');
    const diskLine = diskLines[1]; // Second line has the data
    if (diskLine) {
      const parts = diskLine.trim().split(/\s+/);
      console.log(`  💿 Disk: ${parts[4]} used (${parts[2]}/${parts[1]})`);
    }
  } catch (error) {
    console.log(`  ❌ System info unavailable: ${error.message}`);
  }

  // Check running processes
  console.log('\n🚀 Running Processes:');

  try {
    const pm2Status = execSync('pm2 status', { encoding: 'utf8' });
    console.log('  PM2 Status:');
    pm2Status.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`    ${line}`);
      }
    });
  } catch (error) {
    console.log(`  ❌ PM2 status unavailable: ${error.message}`);
  }

  // Check network connectivity
  console.log('\n🌐 Network Connectivity:');

  const urls = [
    'https://newsapi.org',
    'https://techcrunch.com/feed/',
    'https://api.github.com',
    'https://httpbin.org/get' // Test endpoint
  ];

  for (const url of urls) {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - start;
      const status = response.ok ? '✅' : '⚠️';
      console.log(`  ${status} ${url}: ${response.status} (${latency}ms)`);
    } catch (error) {
      console.log(`  ❌ ${url}: ${error.message}`);
    }
  }

  // Check Node.js and npm versions
  console.log('\n📦 Software Versions:');

  try {
    const nodeVersion = process.version;
    console.log(`  Node.js: ${nodeVersion}`);

    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`  npm: ${npmVersion}`);

    const packageJson = require('../package.json');
    console.log(`  App: ${packageJson.name} v${packageJson.version}`);
  } catch (error) {
    console.log(`  ❌ Version info unavailable: ${error.message}`);
  }

  // Check logs
  console.log('\n📋 Recent Logs:');

  try {
    const logs = execSync('pm2 logs ai-news-app --lines 10 --nostream', { encoding: 'utf8' });
    console.log('  Recent PM2 logs:');
    logs.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`    ${line}`);
      }
    });
  } catch (error) {
    console.log(`  ❌ Logs unavailable: ${error.message}`);
  }

  console.log('\n🎯 Recommendations:');

  // Generate recommendations based on checks
  const recommendations = [];

  if (!process.env.NEWS_API_KEY) {
    recommendations.push('Set NEWS_API_KEY in environment');
  }

  try {
    await fs.access('/tmp', fs.constants.W_OK);
  } catch {
    recommendations.push('Fix /tmp directory permissions (chmod 755 /tmp)');
  }

  try {
    await fs.stat('/tmp/processed-articles.json');
  } catch {
    recommendations.push('Ensure /tmp/processed-articles.json can be created');
  }

  if (recommendations.length === 0) {
    console.log('  ✅ No critical issues detected');
  } else {
    recommendations.forEach(rec => {
      console.log(`  ⚠️  ${rec}`);
    });
  }

  console.log('\n🏁 Environment check completed');
}

// Run the check
checkEnvironment().catch(error => {
  console.error('❌ Environment check failed:', error);
  process.exit(1);
});