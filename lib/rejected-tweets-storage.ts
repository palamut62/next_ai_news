import type { Tweet } from './types'
import crypto from 'crypto'

export interface RejectedTweet {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string
  rejectedAt: string
  originalTweetId: string
  hash: string
}

// In-memory storage for Vercel compatibility
class RejectedTweetsStorage {
  private rejectedTweets: Map<string, RejectedTweet> = new Map()
  private lastUpdate = 0
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  // Generate a hash of the tweet content for duplicate checking
  generateTweetHash(content: string, sourceTitle: string): string {
    const normalizedContent = content.trim().toLowerCase()
    const normalizedTitle = sourceTitle.trim().toLowerCase()
    const combined = `${normalizedContent}|${normalizedTitle}`

    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16)
  }

  async getRejectedTweets(): Promise<RejectedTweet[]> {
    // For Vercel compatibility, return cached tweets
    return Array.from(this.rejectedTweets.values())
  }

  async saveRejectedTweets(rejectedTweets: RejectedTweet[]): Promise<void> {
    // Convert array to map for efficient lookup
    this.rejectedTweets = new Map(rejectedTweets.map(tweet => [tweet.hash, tweet]))
    this.lastUpdate = Date.now()
    console.log(`Saved ${rejectedTweets.length} rejected tweets to in-memory storage`)
  }

  async addRejectedTweet(tweet: Tweet): Promise<void> {
    const hash = this.generateTweetHash(tweet.content, tweet.sourceTitle)

    // Check if already rejected
    if (this.rejectedTweets.has(hash)) {
      return
    }

    const rejectedTweet: RejectedTweet = {
      id: `rejected_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      content: tweet.content,
      sourceTitle: tweet.sourceTitle,
      sourceUrl: tweet.sourceUrl,
      rejectedAt: new Date().toISOString(),
      originalTweetId: tweet.id,
      hash
    }

    this.rejectedTweets.set(hash, rejectedTweet)
    console.log(`Added rejected tweet: "${tweet.content.substring(0, 50)}..."`)
  }

  async isTweetRejected(content: string, sourceTitle: string): Promise<boolean> {
    const hash = this.generateTweetHash(content, sourceTitle)
    return this.rejectedTweets.has(hash)
  }
}

// Export singleton instance
export const rejectedTweetsStorage = new RejectedTweetsStorage()

export async function addRejectedTweet(tweet: Tweet): Promise<void> {
  try {
    await rejectedTweetsStorage.addRejectedTweet(tweet)
  } catch (error) {
    console.error('Failed to add rejected tweet:', error)
    throw error
  }
}

export async function isTweetRejected(content: string, sourceTitle: string): Promise<boolean> {
  try {
    return await rejectedTweetsStorage.isTweetRejected(content, sourceTitle)
  } catch (error) {
    console.error('Failed to check if tweet is rejected:', error)
    return false
  }
}

export async function getRejectedTweetsStats(): Promise<{
  total: number
  today: number
  thisWeek: number
  thisMonth: number
}> {
  try {
    const rejectedTweets = await rejectedTweetsStorage.getRejectedTweets()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    return {
      total: rejectedTweets.length,
      today: rejectedTweets.filter(rt => new Date(rt.rejectedAt) >= today).length,
      thisWeek: rejectedTweets.filter(rt => new Date(rt.rejectedAt) >= weekStart).length,
      thisMonth: rejectedTweets.filter(rt => new Date(rt.rejectedAt) >= monthStart).length
    }
  } catch (error) {
    console.error('Failed to get rejected tweets stats:', error)
    return {
      total: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0
    }
  }
}

export async function cleanupOldRejectedTweets(daysToKeep: number = 90): Promise<void> {
  try {
    const rejectedTweets = await rejectedTweetsStorage.getRejectedTweets()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const filteredTweets = rejectedTweets.filter(rt =>
      new Date(rt.rejectedAt) >= cutoffDate
    )

    if (filteredTweets.length !== rejectedTweets.length) {
      await rejectedTweetsStorage.saveRejectedTweets(filteredTweets)
      console.log(`Cleaned up ${rejectedTweets.length - filteredTweets.length} old rejected tweets`)
    }
  } catch (error) {
    console.error('Failed to cleanup rejected tweets:', error)
    throw error
  }
}