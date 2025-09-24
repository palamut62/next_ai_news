// Test script for TechCrunch and GitHub fetch functions
async function testFetchFunctions() {
  console.log('Testing TechCrunch and GitHub fetch functions...');

  try {
    // Test TechCrunch articles fetch
    console.log('\n1. Testing TechCrunch articles fetch...');
    const techCrunchResponse = await fetch('http://localhost:3003/api/techcrunch/fetch-articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hours: 24
      })
    });

    const techCrunchData = await techCrunchResponse.json();
    console.log('TechCrunch fetch result:', techCrunchData.success ? 'SUCCESS' : 'FAILED');
    console.log('Articles found:', techCrunchData.articles?.length || 0);

    // Test GitHub repos fetch
    console.log('\n2. Testing GitHub repos fetch...');
    // Note: This will likely fail without proper authentication
    const githubResponse = await fetch('http://localhost:3003/api/github/fetch-repos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        count: 10
      })
    });

    const githubData = await githubResponse.json();
    console.log('GitHub fetch result:', githubData.success ? 'SUCCESS' : 'FAILED');
    console.log('Repos found:', githubData.repos?.length || 0);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testFetchFunctions();
}

module.exports = { testFetchFunctions };