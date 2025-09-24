import fs from 'fs/promises'
import path from 'path'
import type { Tweet } from './types'

interface StoredTweet extends Tweet {
  processedAt: string
  duplicateCheck?: {
    titleHash: string
    contentHash: string
    urlHash: string
  }
}

interface TweetStats {
  totalProcessed: number
  totalPosted: number
  totalDeleted: number
  totalDuplicates: number
  bySource: Record<string, {
    processed: number
    posted: number
    deleted: number
    duplicates: number
  }>
  byDay: Record<string, {
    processed: number
    posted: number
    deleted: number
  }>
  lastUpdated: string
}

class TweetStorage {
  private readonly postedTweetsPath: string
  private readonly deletedTweetsPath: string
  private readonly statsPath: string

  constructor() {
    this.postedTweetsPath = path.join(process.cwd(), 'data', 'posted-tweets.json')
    this.deletedTweetsPath = path.join(process.cwd(), 'data', 'deleted-tweets.json')
    this.statsPath = path.join(process.cwd(), 'data', 'tweet-stats.json')
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.join(process.cwd(), 'data')
    try {
      await fs.access(dataDir)
    } catch {
      await fs.mkdir(dataDir, { recursive: true })
    }
  }

  private async loadJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      await this.ensureDataDirectory()
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        await this.saveJsonFile(filePath, defaultValue)
        return defaultValue
      }
      throw error
    }
  }

  private async saveJsonFile<T>(filePath: string, data: T): Promise<void> {
    await this.ensureDataDirectory()
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  }

  // Generate hash for duplicate detection
  private generateHash(text: string): string {
    // Simple hash function for detecting duplicates
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  // Check if article is duplicate based on title, URL, or content similarity
  async isDuplicateArticle(article: {
    title: string
    url: string
    description?: string
  }): Promise<{
    isDuplicate: boolean
    reason?: string
    existingTweet?: StoredTweet
  }> {
    try {
      const postedTweets = await this.loadJsonFile<StoredTweet[]>(this.postedTweetsPath, [])
      const deletedTweets = await this.loadJsonFile<StoredTweet[]>(this.deletedTweetsPath, [])

      const allTweets = [...postedTweets, ...deletedTweets]

      // Generate hashes for comparison
      const titleHash = this.generateHash(article.title.toLowerCase().trim())
      const urlHash = this.generateHash(article.url.toLowerCase().trim())
      const contentHash = article.description
        ? this.generateHash(article.description.toLowerCase().trim().substring(0, 200))
        : ''

      // Check for exact title match
      const titleMatch = allTweets.find(tweet => {
        if (!tweet.duplicateCheck?.titleHash) return false
        return tweet.duplicateCheck.titleHash === titleHash
      })

      if (titleMatch) {
        return {
          isDuplicate: true,
          reason: 'Title already processed',
          existingTweet: titleMatch
        }
      }

      // Check for URL match
      const urlMatch = allTweets.find(tweet => {
        if (!tweet.duplicateCheck?.urlHash) return false
        return tweet.duplicateCheck.urlHash === urlHash
      })

      if (urlMatch) {
        return {
          isDuplicate: true,
          reason: 'URL already processed',
          existingTweet: urlMatch
        }
      }

      // Check for content similarity (if description available)
      if (contentHash && article.description) {
        const contentMatch = allTweets.find(tweet => {
          if (!tweet.duplicateCheck?.contentHash) return false
          return tweet.duplicateCheck.contentHash === contentHash
        })

        if (contentMatch) {
          return {
            isDuplicate: true,
            reason: 'Similar content already processed',
            existingTweet: contentMatch
          }
        }
      }

      // Check for very similar titles (fuzzy matching)
      const similarTitle = allTweets.find(tweet => {
        const existingTitle = tweet.sourceTitle.toLowerCase()
        const newTitle = article.title.toLowerCase()

        // Simple similarity check - contains significant overlapping words
        const existingWords = existingTitle.split(/\s+/)
        const newWords = newTitle.split(/\s+/)

        const commonWords = existingWords.filter(word =>
          word.length > 3 && newWords.includes(word)
        )

        return commonWords.length >= 3 // At least 3 meaningful words in common
      })

      if (similarTitle) {
        return {
          isDuplicate: true,
          reason: 'Very similar title already processed',
          existingTweet: similarTitle
        }
      }

      return {
        isDuplicate: false
      }

    } catch (error) {
      console.error('Duplicate check failed:', error)
      // If duplicate check fails, assume it's not a duplicate to avoid missing content
      return {
        isDuplicate: false
      }
    }
  }

  // Save posted tweet
  async savePostedTweet(tweet: Tweet, originalArticle?: {
    title: string
    description?: string
    url: string
  }): Promise<void> {
    try {
      const postedTweets = await this.loadJsonFile<StoredTweet[]>(this.postedTweetsPath, [])

      const storedTweet: StoredTweet = {
        ...tweet,
        processedAt: new Date().toISOString(),
        duplicateCheck: originalArticle ? {
          titleHash: this.generateHash(originalArticle.title.toLowerCase().trim()),
          contentHash: originalArticle.description
            ? this.generateHash(originalArticle.description.toLowerCase().trim().substring(0, 200))
            : '',
          urlHash: this.generateHash(originalArticle.url.toLowerCase().trim())
        } : undefined
      }

      postedTweets.push(storedTweet)
      await this.saveJsonFile(this.postedTweetsPath, postedTweets)

      // Update statistics
      await this.updateStats('posted', tweet.source)

      console.log(`💾 Saved posted tweet: ${tweet.id}`)
    } catch (error) {
      console.error('Failed to save posted tweet:', error)
      throw error
    }
  }

  // Save deleted tweet
  async saveDeletedTweet(tweet: Tweet, reason: string = 'manual_delete'): Promise<void> {
    try {
      const deletedTweets = await this.loadJsonFile<StoredTweet[]>(this.deletedTweetsPath, [])

      const storedTweet: StoredTweet = {
        ...tweet,
        processedAt: new Date().toISOString()
      }

      deletedTweets.push(storedTweet)
      await this.saveJsonFile(this.deletedTweetsPath, deletedTweets)

      // Update statistics
      await this.updateStats('deleted', tweet.source)

      console.log(`🗑️ Saved deleted tweet: ${tweet.id} (${reason})`)
    } catch (error) {
      console.error('Failed to save deleted tweet:', error)
      throw error
    }
  }

  // Get statistics
  async getStats(): Promise<TweetStats> {
    try {
      return await this.loadJsonFile<TweetStats>(this.statsPath, {
        totalProcessed: 0,
        totalPosted: 0,
        totalDeleted: 0,
        totalDuplicates: 0,
        bySource: {},
        byDay: {},
        lastUpdated: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to get stats:', error)
      throw error
    }
  }

  // Update statistics
  private async updateStats(action: 'posted' | 'deleted' | 'duplicate', source: string): Promise<void> {
    try {
      const stats = await this.getStats()
      const today = new Date().toISOString().split('T')[0]

      // Update overall stats
      if (action === 'posted') {
        stats.totalPosted++
        stats.totalProcessed++
      } else if (action === 'deleted') {
        stats.totalDeleted++
      } else if (action === 'duplicate') {
        stats.totalDuplicates++
      }

      // Update source stats
      if (!stats.bySource[source]) {
        stats.bySource[source] = {
          processed: 0,
          posted: 0,
          deleted: 0,
          duplicates: 0
        }
      }

      if (action === 'posted') {
        stats.bySource[source].posted++
        stats.bySource[source].processed++
      } else if (action === 'deleted') {
        stats.bySource[source].deleted++
      } else if (action === 'duplicate') {
        stats.bySource[source].duplicates++
      }

      // Update daily stats
      if (!stats.byDay[today]) {
        stats.byDay[today] = {
          processed: 0,
          posted: 0,
          deleted: 0
        }
      }

      if (action === 'posted') {
        stats.byDay[today].posted++
        stats.byDay[today].processed++
      } else if (action === 'deleted') {
        stats.byDay[today].deleted++
      }

      stats.lastUpdated = new Date().toISOString()
      await this.saveJsonFile(this.statsPath, stats)
    } catch (error) {
      console.error('Failed to update stats:', error)
    }
  }

  // Get recent activity
  async getRecentActivity(days: number = 7) {
    const stats = await this.getStats()
    const recentDays = Object.keys(stats.byDay)
      .sort()
      .slice(-days)
      .reduce((obj, day) => {
        obj[day] = stats.byDay[day]
        return obj
      }, {} as Record<string, any>)

    return {
      recentDays,
      summary: {
        totalPosted: stats.totalPosted,
        totalDeleted: stats.totalDeleted,
        totalDuplicates: stats.totalDuplicates,
        topSources: Object.entries(stats.bySource)
          .sort(([,a], [,b]) => b.posted - a.posted)
          .slice(0, 5)
      }
    }
  }
}

// Export singleton instance
export const tweetStorage = new TweetStorage()

// Export utility functions
export async function isDuplicateArticle(article: {
  title: string
  url: string
  description?: string
}) {
  return await tweetStorage.isDuplicateArticle(article)
}

export async function savePostedTweet(tweet: Tweet, article?: {
  title: string
  description?: string
  url: string
}) {
  return await tweetStorage.savePostedTweet(tweet, article)
}

export async function saveDeletedTweet(tweet: Tweet, reason?: string) {
  return await tweetStorage.saveDeletedTweet(tweet, reason)
}

export async function getTweetStats() {
  return await tweetStorage.getStats()
}

export async function getRecentActivity(days?: number) {
  return await tweetStorage.getRecentActivity(days)
}