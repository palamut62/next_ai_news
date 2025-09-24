# Twitter API Integration Guide

This document describes the automatic tweet sharing functionality implemented in the AI News Tweet App.

## Features Implemented

### 1. Twitter API Client (`lib/twitter-client.ts`)
- **Post tweets**: Send tweets to Twitter using v2 API
- **Get engagement metrics**: Track likes, retweets, and replies
- **Reply to tweets**: Reply to existing tweets
- **Error handling**: Comprehensive error handling for API failures

### 2. Tweet Scheduler (`lib/tweet-scheduler.ts`)
- **Scheduled posting**: Schedule tweets for future posting
- **Auto-posting**: Automatically post approved tweets based on settings
- **Rate limiting**: Built-in delays to respect Twitter API rate limits
- **Engagement tracking**: Track engagement after posting

### 3. API Endpoints

#### POST `/api/tweets/post-now`
Post a tweet immediately to Twitter.

**Request:**
```json
{
  "content": "Your tweet content here",
  "source": "manual",
  "sourceUrl": "https://example.com",
  "sourceTitle": "Source Title",
  "aiScore": 8.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tweet posted successfully!",
  "tweet": {
    "id": "twitter_tweet_id",
    "content": "Your tweet content",
    "status": "posted",
    "postedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### POST `/api/tweets/bulk-post`
Post multiple tweets to Twitter.

**Request:**
```json
{
  "tweetIds": ["tweet1_id", "tweet2_id", "tweet3_id"]
}
```

#### POST `/api/tweets/schedule`
Schedule a tweet for future posting.

**Request:**
```json
{
  "action": "schedule",
  "tweet": {
    "content": "Your scheduled tweet",
    "source": "manual"
  },
  "scheduledAt": "2024-01-01T12:00:00Z"
}
```

#### GET `/api/tweets/schedule`
Get all scheduled tweets.

#### POST `/api/tweets/auto-post`
Auto-post approved tweets based on settings.

**Request:**
```json
{
  "tweets": [
    {
      "id": "tweet1_id",
      "content": "Auto-post tweet",
      "status": "approved"
    }
  ],
  "settings": {
    "autoPost": true,
    "requireApproval": true,
    "rateLimitDelay": 5
  }
}
```

## Environment Variables

The following Twitter API credentials are configured in `.env`:

```env
TWITTER_BEARER_TOKEN=your_bearer_token
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

## Usage Examples

### 1. Post a Tweet Immediately

```javascript
// Using the API endpoint
const response = await fetch('/api/tweets/post-now', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'Hello Twitter! This is an automated tweet. 🚀',
    source: 'manual',
    aiScore: 8.0
  })
});

const result = await response.json();
```

### 2. Schedule a Tweet

```javascript
const response = await fetch('/api/tweets/schedule', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: 'schedule',
    tweet: {
      content: 'This tweet will be posted automatically!',
      source: 'manual'
    },
    scheduledAt: '2024-01-01T12:00:00Z'
  })
});
```

### 3. Auto-post Approved Tweets

```javascript
const response = await fetch('/api/tweets/auto-post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tweets: approvedTweets,
    settings: {
      autoPost: true,
      requireApproval: true,
      rateLimitDelay: 5
    }
  })
});
```

## Error Handling

The Twitter API integration includes comprehensive error handling:

- **Authentication errors**: Invalid credentials
- **Rate limiting**: Too many requests
- **Content errors**: Tweets too long or invalid content
- **Network errors**: Connection issues

## Rate Limiting

Twitter API has rate limits:
- **Tweets**: 300 requests per 3 hours
- **User lookup**: 900 requests per 15 minutes
- **Engagement metrics**: 500 requests per 15 minutes

The implementation includes built-in delays to respect these limits.

## Testing

Use the provided test script to verify the integration:

```bash
node test-twitter-integration.js
```

## Security Considerations

- All API credentials are stored in environment variables
- Authentication is required for all API endpoints
- Input validation is performed on all requests
- Error messages are sanitized to prevent information leakage

## Monitoring

The system logs:
- Tweet posting attempts
- Success/failure status
- Engagement metrics updates
- Scheduler activity