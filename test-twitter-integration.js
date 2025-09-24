// Test script for Twitter API integration
const { postTweetToTwitter } = require('./lib/twitter-client.ts');

async function testTwitterIntegration() {
  console.log('Testing Twitter API integration...');

  try {
    // Test with a simple tweet
    const result = await postTweetToTwitter('Testing AI tweet automation! 🚀 #AI #Twitter #Automation');

    console.log('Twitter API Test Result:');
    console.log('Success:', result.success);

    if (result.success) {
      console.log('Tweet ID:', result.tweetId);
      console.log('Tweet posted successfully!');
    } else {
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testTwitterIntegration();
}

module.exports = { testTwitterIntegration };