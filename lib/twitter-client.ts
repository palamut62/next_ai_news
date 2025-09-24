import 'dotenv/config'
import type { Tweet } from '@/lib/types'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import { generateHashtags } from './hashtag'

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
  private config: TwitterConfig
  private oauth: OAuth

  constructor() {
    this.config = {
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || ''
    }

    if (!this.config.apiKey || !this.config.apiSecret ||
        !this.config.accessToken || !this.config.accessTokenSecret) {
      throw new Error('Twitter API credentials are not configured properly')
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
  }

  async postTweet(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      // Generate hashtags and append to content if there is space
      const hashtags = generateHashtags(content, 4)
      const hashtagsSuffix = hashtags.length ? '\n' + hashtags.join(' ') : ''
      const maxLen = 280
      let bodyText = content
      if (bodyText.length + hashtagsSuffix.length > maxLen) {
        // truncate lightly to fit hashtags
        const allowed = maxLen - hashtagsSuffix.length - 3
        bodyText = bodyText.slice(0, Math.max(0, allowed)) + '...'
      }
      bodyText = bodyText + hashtagsSuffix

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

export async function postTweetToTwitter(content: string): Promise<{
  success: boolean
  tweetId?: string
  error?: string
}> {
  const client = createTwitterClient()
  return await client.postTweet(content)
}

export async function updateTweetEngagement(tweetId: string): Promise<{
  likes: number
  retweets: number
  replies: number
} | null> {
  const client = createTwitterClient()
  return await client.getTweetMetrics(tweetId)
}