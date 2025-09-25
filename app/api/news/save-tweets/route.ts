import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { isTweetRejected } from "@/lib/rejected-tweets-storage"
import fs from "fs/promises"
import path from "path"
import { logAPIEvent } from "@/lib/audit-logger"

interface Tweet {
  id: string
  content: string
  source: string
  sourceUrl: string
  sourceTitle: string
  aiScore: number
  status: string
  createdAt: string
  publishedAt: string
  engagement: {
    likes: number
    retweets: number
    replies: number
  }
  newsData?: {
    originalTitle: string
    publishedAt: string
    sourceName: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('save_tweets_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { tweets } = await request.json() as { tweets: Tweet[] }

    if (!tweets || tweets.length === 0) {
      return Response.json({ error: "No tweets provided" }, { status: 400 })
    }

    // Get existing tweets from storage
    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true })

    let existingTweets: Tweet[] = []

    try {
      const tweetsData = await fs.readFile(tweetsFile, "utf-8")
      existingTweets = JSON.parse(tweetsData)
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
      existingTweets = []
    }

    // Filter out tweets that have been rejected
    const filteredTweets = []
    const skippedRejected = []
    const skippedDuplicates = []

    for (const tweet of tweets) {
      // Check if tweet has been rejected
      const isRejected = await isTweetRejected(tweet.content, tweet.sourceTitle)

      if (isRejected) {
        skippedRejected.push(tweet)
        continue
      }

      // Check for duplicates in existing tweets
      const isDuplicate = existingTweets.some(existingTweet =>
        existingTweet.content === tweet.content &&
        existingTweet.sourceTitle === tweet.sourceTitle
      )

      if (isDuplicate) {
        skippedDuplicates.push(tweet)
        continue
      }

      filteredTweets.push(tweet)
    }

    // Add new tweets
    const newTweets = filteredTweets.map(tweet => ({
      ...tweet,
      id: `news_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      createdAt: new Date().toISOString()
    }))

    existingTweets.push(...newTweets)

    // Save back to file
    await fs.writeFile(tweetsFile, JSON.stringify(existingTweets, null, 2))

    // Log successful save operation
    await logAPIEvent('save_tweets_success', true, request, {
      savedCount: newTweets.length,
      totalCount: existingTweets.length,
      skippedRejected: skippedRejected.length,
      skippedDuplicates: skippedDuplicates.length,
      userEmail: auth.email
    })

    return Response.json({
      success: true,
      saved: newTweets.length,
      total: existingTweets.length,
      savedTweets: newTweets,
      skippedRejected: skippedRejected.length,
      skippedDuplicates: skippedDuplicates.length,
      savedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Save tweets from news error:", error)
    await logAPIEvent('save_tweets_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      tweetsCount: tweets?.length
    })
    return Response.json({ error: "Failed to save tweets from news" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('get_tweets_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    let tweets: Tweet[] = []

    try {
      const tweetsData = await fs.readFile(tweetsFile, "utf-8")
      tweets = JSON.parse(tweetsData)
    } catch (error) {
      // File doesn't exist or is empty
      tweets = []
    }

    // Filter only AI news tweets
    const newsTweets = tweets.filter(tweet => tweet.source === "ai_news")

    return Response.json({
      success: true,
      tweets: newsTweets,
      count: newsTweets.length,
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Get news tweets error:", error)
    await logAPIEvent('get_tweets_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return Response.json({ error: "Failed to get news tweets" }, { status: 500 })
  }
}