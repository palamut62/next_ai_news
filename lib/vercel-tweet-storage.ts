import type { Tweet } from './types'

interface StoredTweet extends Tweet {
  processedAt: string
}

class VercelTweetStorage {
  private tweets: Map<string, StoredTweet> = new Map()

  // Generate unique ID for tweet
  private generateTweetId(tweet: Tweet): string {
    const content = tweet.content.substring(0, 100).toLowerCase().replace(/\s+/g, ' ').trim()
    const timestamp = new Date(tweet.createdAt).getTime()
    return `${timestamp}_${btoa(content).substring(0, 20)}`
  }

  // Check if tweet is duplicate
  async isDuplicateTweet(tweet: Tweet): Promise<boolean> {
    const tweetId = this.generateTweetId(tweet)
    return this.tweets.has(tweetId)
  }

  // Check if TechCrunch article was already posted
  async isDuplicateTechCrunchArticle(articleUrl: string): Promise<boolean> {
    for (const tweet of this.tweets.values()) {
      if (tweet.source === 'techcrunch' &&
          (tweet.sourceUrl === articleUrl ||
           tweet.sourceUrl?.toLowerCase() === articleUrl.toLowerCase())) {
        return true
      }
    }
    return false
  }

  // Check if GitHub repo was already posted
  async isDuplicateGithubRepo(repoUrl: string): Promise<boolean> {
    for (const tweet of this.tweets.values()) {
      if (tweet.source === 'github' &&
          (tweet.sourceUrl === repoUrl ||
           tweet.sourceUrl?.toLowerCase() === repoUrl.toLowerCase())) {
        return true
      }
    }
    return false
  }

  // Save tweet
  async saveTweet(tweet: Tweet): Promise<boolean> {
    try {
      const tweetId = this.generateTweetId(tweet)

      // Check if already exists
      if (this.tweets.has(tweetId)) {
        return false
      }

      const storedTweet: StoredTweet = {
        ...tweet,
        processedAt: new Date().toISOString()
      }

      this.tweets.set(tweetId, storedTweet)
      console.log(`Tweet saved successfully: ${tweet.content.substring(0, 50)}...`)
      return true
    } catch (error) {
      console.error('Failed to save tweet:', error)
      return false
    }
  }

  // Get all tweets
  async getAllTweets(): Promise<StoredTweet[]> {
    return Array.from(this.tweets.values())
  }

  // Get tweets by status
  async getTweetsByStatus(status: Tweet['status']): Promise<StoredTweet[]> {
    return Array.from(this.tweets.values()).filter(tweet => tweet.status === status)
  }

  // Update tweet status
  async updateTweetStatus(tweetId: string, status: Tweet['status'], postedAt?: string): Promise<boolean> {
    try {
      // Find tweet by ID (iterate through all tweets)
      for (const [id, tweet] of this.tweets) {
        if (tweet.id === tweetId) {
          tweet.status = status
          if (postedAt) {
            tweet.postedAt = postedAt
          }
          this.tweets.set(id, tweet)
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Failed to update tweet status:', error)
      return false
    }
  }

  // Delete tweet
  async deleteTweet(tweetId: string): Promise<boolean> {
    try {
      // Find tweet by ID (iterate through all tweets)
      for (const [id, tweet] of this.tweets) {
        if (tweet.id === tweetId) {
          this.tweets.delete(id)
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Failed to delete tweet:', error)
      return false
    }
  }

  // Get statistics
  async getStats() {
    const allTweets = Array.from(this.tweets.values())

    return {
      totalTweets: allTweets.length,
      pendingTweets: allTweets.filter(t => t.status === 'pending').length,
      approvedTweets: allTweets.filter(t => t.status === 'approved').length,
      rejectedTweets: allTweets.filter(t => t.status === 'rejected').length,
      postedTweets: allTweets.filter(t => t.status === 'posted').length,
      bySource: this.groupBySource(allTweets),
      byDay: this.groupByDay(allTweets)
    }
  }

  private groupBySource(tweets: StoredTweet[]) {
    const groups: Record<string, number> = {}
    tweets.forEach(tweet => {
      groups[tweet.source] = (groups[tweet.source] || 0) + 1
    })
    return groups
  }

  private groupByDay(tweets: StoredTweet[]) {
    const groups: Record<string, number> = {}
    tweets.forEach(tweet => {
      const day = new Date(tweet.createdAt).toISOString().split('T')[0]
      groups[day] = (groups[day] || 0) + 1
    })
    return groups
  }
}

// Export singleton instance
export const vercelTweetStorage = new VercelTweetStorage()