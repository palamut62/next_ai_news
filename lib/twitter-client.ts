import 'dotenv/config'
import type { Tweet } from '@/lib/types'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import { generateHashtags } from './hashtag'
import { getApiKeyFromFirebaseOrEnv } from './firebase-api-keys'

interface TwitterConfig {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
  bearerToken: string
}

interface TwitterResponse {
  data?: {
    id: string
    text: string
    created_at: string
    public_metrics?: {
      retweet_count: number
      like_count: number
      reply_count: number
    }
  }
  errors?: Array<{
    message: string
    code: number
  }>
}

class TwitterClient {
  private config: TwitterConfig | null = null
  private oauth: OAuth | null = null
  private initialized = false

  async initialize() {
    if (this.initialized) return

    try {
      // Get Twitter API key from Firebase, which contains all Twitter credentials as JSON
      const twitterKeyJson = await getApiKeyFromFirebaseOrEnv('twitter', 'TWITTER_API_KEY')

      if (!twitterKeyJson) {
        throw new Error('Twitter API credentials not found in Firebase or environment variables')
      }

      // Parse the JSON if it's a string
      let twitterCredentials: any
      try {
        twitterCredentials = typeof twitterKeyJson === 'string' ? JSON.parse(twitterKeyJson) : twitterKeyJson
      } catch {
        // If not JSON, assume it's the old format with individual env vars
        twitterCredentials = {
          api_key: process.env.TWITTER_API_KEY || '',
          api_secret: process.env.TWITTER_API_SECRET || '',
          access_token: process.env.TWITTER_ACCESS_TOKEN || '',
          access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
          bearer_token: process.env.TWITTER_BEARER_TOKEN || ''
        }
      }

      this.config = {
        apiKey: twitterCredentials.api_key || twitterCredentials.apiKey || '',
        apiSecret: twitterCredentials.api_secret || twitterCredentials.apiSecret || '',
        accessToken: twitterCredentials.access_token || twitterCredentials.accessToken || '',
        accessTokenSecret: twitterCredentials.access_token_secret || twitterCredentials.accessTokenSecret || '',
        bearerToken: twitterCredentials.bearer_token || twitterCredentials.bearerToken || ''
      }

      if (!this.config.apiKey || !this.config.apiSecret ||
          !this.config.accessToken || !this.config.accessTokenSecret) {
        throw new Error('Twitter API credentials are not properly configured')
      }

      this.oauth = new OAuth({
        consumer: {
          key: this.config.apiKey,
          secret: this.config.apiSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
          return crypto.createHmac('sha1', key).update(base_string).digest('base64')
        }
      })

      this.initialized = true
      console.log('✅ Twitter client initialized from Firebase')
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error)
      throw error
    }
  }

  async postTweet(content: string, sourceUrl?: string, hashtags?: string[]): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      await this.initialize()

      if (!this.config || !this.oauth) {
        return {
          success: false,
          error: 'Twitter client not properly initialized'
        }
      }

      // Use provided hashtags or generate them if needed
      const finalHashtags = hashtags && hashtags.length > 0 ? hashtags : generateHashtags(content, 4)
      const hashtagsSuffix = finalHashtags.length ? '\n' + finalHashtags.join(' ') : ''
      const rawUrl = sourceUrl && sourceUrl.trim() ? sourceUrl.trim() : ''
      let sourceSuffix = ''
      if (rawUrl && !content.includes(rawUrl)) {
        sourceSuffix = '\n' + rawUrl
      }

      const maxLen = 280
      let bodyText = content
      const reserved = sourceSuffix.length + hashtagsSuffix.length
      if (bodyText.length + reserved > maxLen) {
        // truncate lightly to fit hashtags and source URL
        const allowed = maxLen - reserved - 3
        bodyText = bodyText.slice(0, Math.max(0, allowed)) + '...'
      }
      bodyText = bodyText + sourceSuffix + hashtagsSuffix

      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: bodyText,
        }),
      });

      const data: TwitterResponse = await response.json();

      if (data.errors) {
        return {
          success: false,
          error: data.errors.map(e => e.message).join(", "),
        };
      }

      if (data.data) {
        return {
          success: true,
          tweetId: data.data.id,
          // expose hashtags used for logging/debug
          // (caller can ignore)
          error: undefined,
        } as any;
      }

      return {
        success: false,
        error: "Unknown Twitter API response",
      };
    } catch (error) {
      console.error("❌ Twitter API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to post tweet",
      };
    }
  }

  async getTweetMetrics(tweetId: string): Promise<{
    likes: number
    retweets: number
    replies: number
  } | null> {
    try {
      await this.initialize()

      if (!this.config) {
        return null
      }

      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.bearerToken}`,
          }
        }
      )

      const data: TwitterResponse = await response.json()

      if (data.data?.public_metrics) {
        return {
          likes: data.data.public_metrics.like_count,
          retweets: data.data.public_metrics.retweet_count,
          replies: data.data.public_metrics.reply_count
        }
      }

      return null

    } catch (error) {
      console.error('Failed to fetch tweet metrics:', error)
      return null
    }
  }

  async replyToTweet(parentTweetId: string, content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      await this.initialize()

      if (!this.config) {
        return {
          success: false,
          error: 'Twitter client not properly initialized'
        }
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          reply: {
            in_reply_to_tweet_id: parentTweetId
          }
        })
      })

      const data: TwitterResponse = await response.json()

      if (data.errors) {
        return {
          success: false,
          error: data.errors.map(e => e.message).join(', ')
        }
      }

      if (data.data) {
        return {
          success: true,
          tweetId: data.data.id
        }
      }

      return {
        success: false,
        error: 'Unknown Twitter API response'
      }

    } catch (error) {
      console.error('Twitter API error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reply to tweet'
      }
    }
  }
}

export function createTwitterClient(): TwitterClient {
  return new TwitterClient()
}

export async function postTweetToTwitter(content: string, sourceUrl?: string, hashtags?: string[]): Promise<{
  success: boolean
  tweetId?: string
  error?: string
}> {
  const client = createTwitterClient()
  const result = await client.postTweet(content, sourceUrl)

  // Include hashtags in the result for reference
  return {
    ...result,
    hashtags: hashtags
  } as any
}

export async function updateTweetEngagement(tweetId: string): Promise<{
  likes: number
  retweets: number
  replies: number
} | null> {
  const client = createTwitterClient()
  return await client.getTweetMetrics(tweetId)
}