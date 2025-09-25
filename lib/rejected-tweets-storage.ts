import fs from 'fs/promises'
import path from 'path'
import type { Tweet } from './types'

export interface RejectedTweet {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string
  rejectedAt: string
  originalTweetId: string
  hash: string
}

// Generate a hash of the tweet content for duplicate checking
function generateTweetHash(content: string, sourceTitle: string): string {
  const normalizedContent = content.trim().toLowerCase()
  const normalizedTitle = sourceTitle.trim().toLowerCase()
  const combined = `${normalizedContent}|${normalizedTitle}`

  // Simple hash function - in production you might want to use a proper crypto hash
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString()
}

async function getRejectedTweets(): Promise<RejectedTweet[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const rejectedTweetsFile = path.join(dataDir, 'rejected-tweets.json')

    const data = await fs.readFile(rejectedTweetsFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function saveRejectedTweets(rejectedTweets: RejectedTweet[]): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const rejectedTweetsFile = path.join(dataDir, 'rejected-tweets.json')

    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(rejectedTweetsFile, JSON.stringify(rejectedTweets, null, 2))
  } catch (error) {
    console.error('Failed to save rejected tweets:', error)
    throw error
  }
}

export async function addRejectedTweet(tweet: Tweet): Promise<void> {
  try {
    const rejectedTweets = await getRejectedTweets()
    const hash = generateTweetHash(tweet.content, tweet.sourceTitle)

    // Check if already rejected
    const exists = rejectedTweets.some(rt => rt.hash === hash)
    if (exists) {
      return // Already exists, no need to add duplicate
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

    rejectedTweets.push(rejectedTweet)
    await saveRejectedTweets(rejectedTweets)
  } catch (error) {
    console.error('Failed to add rejected tweet:', error)
    throw error
  }
}

export async function isTweetRejected(content: string, sourceTitle: string): Promise<boolean> {
  try {
    const rejectedTweets = await getRejectedTweets()
    const hash = generateTweetHash(content, sourceTitle)

    return rejectedTweets.some(rt => rt.hash === hash)
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
    const rejectedTweets = await getRejectedTweets()
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
    const rejectedTweets = await getRejectedTweets()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const filteredTweets = rejectedTweets.filter(rt =>
      new Date(rt.rejectedAt) >= cutoffDate
    )

    if (filteredTweets.length !== rejectedTweets.length) {
      await saveRejectedTweets(filteredTweets)
      console.log(`Cleaned up ${rejectedTweets.length - filteredTweets.length} old rejected tweets`)
    }
  } catch (error) {
    console.error('Failed to cleanup rejected tweets:', error)
    throw error
  }
}