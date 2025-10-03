#!/usr/bin/env node

/**
 * API Endpoint Test Script
 * Tests various endpoints to diagnose connectivity issues
 */

const BASE_URL = process.env.TEST_URL || 'http://77.37.54.38:3001';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n🔍 Testing ${name}...`);
  console.log(`📍 URL: ${url}`);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    const latency = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';

    console.log(`⏱️  Latency: ${latency}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Content-Type: ${contentType}`);

    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
      console.log(`📦 Response keys: ${Object.keys(responseData).join(', ')}`);
    } else {
      const text = await response.text();
      console.log(`📝 Response preview (${text.length} chars): ${text.substring(0, 200)}...`);
    }

    if (response.ok) {
      console.log(`✅ ${name}: SUCCESS`);
      return { success: true, latency, data: responseData };
    } else {
      console.log(`❌ ${name}: FAILED`);
      return { success: false, latency, error: `HTTP ${response.status}` };
    }

  } catch (error) {
    const latency = Date.now() - startTime;
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return { success: false, latency, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting API Endpoint Tests');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  const results = {};

  // Test connectivity endpoint
  results.connectivity = await testEndpoint(
    'Connectivity Test',
    `${BASE_URL}/api/news/test-connectivity`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }
  );

  // Test main news fetch endpoint
  results.newsFetch = await testEndpoint(
    'AI News Fetch',
    `${BASE_URL}/api/news/fetch-ai-news`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5 })
    }
  );

  // Test TechCrunch endpoint
  results.techcrunch = await testEndpoint(
    'TechCrunch Articles',
    `${BASE_URL}/api/techcrunch/fetch-articles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: 24 })
    }
  );

  // Test GitHub endpoint
  results.github = await testEndpoint(
    'GitHub Repos',
    `${BASE_URL}/api/github/fetch-repos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 10 })
    }
  );

  // Test simple endpoint
  results.simple = await testEndpoint(
    'Simple Health Check',
    `${BASE_URL}/api/auth/check`
  );

  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('=' .repeat(50));

  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const latency = result.latency ? `${result.latency}ms` : 'N/A';
    console.log(`${status} ${name.padEnd(20)} ${latency.padStart(10)}`);

    if (!result.success && result.error) {
      console.log(`    💬 Error: ${result.error}`);
    }
  });

  const successCount = Object.values(results).filter(r => r.success).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n📈 Overall: ${successCount}/${totalCount} tests passed`);

  if (results.connectivity?.success && results.connectivity?.data?.results) {
    console.log('\n🔍 Connectivity Details:');
    const connectivity = results.connectivity.data.results;

    Object.entries(connectivity.connectivity).forEach(([service, status]) => {
      const icon = status.status === 'success' ? '✅' : '❌';
      const latency = status.latency ? `${status.latency}ms` : '';
      console.log(`  ${icon} ${service.padEnd(15)} ${status.message} ${latency}`);
    });

    console.log('\n🔧 Environment Variables:');
    Object.entries(connectivity.environment).forEach(([key, value]) => {
      const display = typeof value === 'boolean' ? (value ? '✅ Set' : '❌ Missing') : value;
      console.log(`  ${key}: ${display}`);
    });
  }

  console.log(`\n⏰ Completed at: ${new Date().toISOString()}`);

  if (successCount < totalCount) {
    console.log('\n🚨 Some tests failed. Check the detailed errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed successfully!');
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});