import { postTweetToTwitter, updateTweetEngagement } from './twitter-client'
import type { Tweet } from './types'

interface ScheduledTweet extends Tweet {
  scheduledAt: string
  autoPost: boolean
}

class TweetScheduler {
  private scheduledTweets: Map<string, ScheduledTweet> = new Map()
  private isRunning: boolean = false
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startScheduler()
  }

  startScheduler() {
    if (this.isRunning) return

    this.isRunning = true
    this.checkInterval = setInterval(() => {
      this.checkAndPostScheduledTweets()
    }, 60000) // Check every minute

    console.log('Tweet scheduler started')
  }

  stopScheduler() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    console.log('Tweet scheduler stopped')
  }

  scheduleTweet(tweet: ScheduledTweet): boolean {
    const scheduledTime = new Date(tweet.scheduledAt)
    const now = new Date()

    if (scheduledTime <= now) {
      console.error('Cannot schedule tweet for past time')
      return false
    }

    this.scheduledTweets.set(tweet.id, tweet)
    console.log(`Tweet ${tweet.id} scheduled for ${scheduledTime.toISOString()}`)
    return true
  }

  unscheduleTweet(tweetId: string): boolean {
    return this.scheduledTweets.delete(tweetId)
  }

  getScheduledTweets(): ScheduledTweet[] {
    return Array.from(this.scheduledTweets.values()).sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
  }

  private async checkAndPostScheduledTweets() {
    const now = new Date()
    const tweetsToPost: ScheduledTweet[] = []

    // Find tweets that should be posted now
    for (const [tweetId, tweet] of this.scheduledTweets) {
      if (new Date(tweet.scheduledAt) <= now) {
        tweetsToPost.push(tweet)
      }
    }

    // Post scheduled tweets
    for (const tweet of tweetsToPost) {
      if (tweet.autoPost) {
        await this.postScheduledTweet(tweet)
      }
      this.scheduledTweets.delete(tweet.id)
    }
  }

  private async postScheduledTweet(tweet: ScheduledTweet) {
    try {
      console.log(`Posting scheduled tweet ${tweet.id}: ${tweet.content.substring(0, 50)}...`)

      const result = await postTweetToTwitter(tweet.content)

      if (result.success) {
        console.log(`Successfully posted scheduled tweet ${tweet.id} with Twitter ID: ${result.tweetId}`)

        // Update tweet status to posted
        // In a real implementation, you would save this to your database
        tweet.status = 'posted'
        tweet.postedAt = new Date().toISOString()

        // Track engagement after a delay
        setTimeout(async () => {
          if (result.tweetId) {
            const metrics = await updateTweetEngagement(result.tweetId)
            if (metrics) {
              console.log(`Engagement for tweet ${tweet.id}:`, metrics)
              // In a real implementation, you would update the database with engagement metrics
            }
          }
        }, 30000) // Check engagement after 30 seconds

      } else {
        console.error(`Failed to post scheduled tweet ${tweet.id}: ${result.error}`)
        // In a real implementation, you would update the database with the error
      }

    } catch (error) {
      console.error(`Error posting scheduled tweet ${tweet.id}:`, error)
      // In a real implementation, you would update the database with the error
    }
  }

  // Auto-post approved tweets based on automation settings
  async autoPostApprovedTweets(
    tweets: Tweet[],
    settings: {
      autoPost: boolean
      requireApproval: boolean
      rateLimitDelay: number
    }
  ): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    if (!settings.autoPost) {
      return { success: 0, failed: 0, errors: ['Auto-post is disabled'] }
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    const tweetsToPost = tweets.filter(tweet =>
      tweet.status === 'approved' || (!settings.requireApproval && tweet.status === 'pending')
    )

    for (const tweet of tweetsToPost) {
      try {
        const result = await postTweetToTwitter(tweet.content)

        if (result.success) {
          results.success++
          console.log(`Auto-posted tweet ${tweet.id}`)

          // Update tweet status to posted
          tweet.status = 'posted'
          tweet.postedAt = new Date().toISOString()

          // Track engagement after a delay
          setTimeout(async () => {
            if (result.tweetId) {
              const metrics = await updateTweetEngagement(result.tweetId)
              if (metrics) {
                tweet.engagement = metrics
              }
            }
          }, 30000)

        } else {
          results.failed++
          results.errors.push(`Tweet ${tweet.id}: ${result.error}`)
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, settings.rateLimitDelay * 1000))

      } catch (error) {
        results.failed++
        results.errors.push(`Tweet ${tweet.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return results
  }
}

// Global scheduler instance
export const tweetScheduler = new TweetScheduler()

// Helper functions
export function scheduleTweet(tweet: Tweet, scheduledAt: string, autoPost: boolean = true): boolean {
  const scheduledTweet: ScheduledTweet = {
    ...tweet,
    scheduledAt,
    autoPost
  }

  return tweetScheduler.scheduleTweet(scheduledTweet)
}

export function unscheduleTweet(tweetId: string): boolean {
  return tweetScheduler.unscheduleTweet(tweetId)
}

export function getScheduledTweets(): Tweet[] {
  return tweetScheduler.getScheduledTweets()
}

export async function autoPostTweets(
  tweets: Tweet[],
  settings: {
    autoPost: boolean
    requireApproval: boolean
    rateLimitDelay: number
  }
) {
  return await tweetScheduler.autoPostApprovedTweets(tweets, settings)
}