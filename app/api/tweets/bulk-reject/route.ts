import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"
import type { Tweet } from "@/lib/types"
import { addRejectedTweet } from "@/lib/rejected-tweets-storage"

async function getTweets(): Promise<Tweet[]> {
  try {
    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    const tweetsData = await fs.readFile(tweetsFile, "utf-8")
    return JSON.parse(tweetsData)
  } catch (error) {
    return []
  }
}

async function saveTweets(tweets: Tweet[]): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(tweetsFile, JSON.stringify(tweets, null, 2))
  } catch (error) {
    console.error("Failed to save tweets:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { tweetIds } = await request.json()

    if (!tweetIds || !Array.isArray(tweetIds)) {
      return Response.json({ error: "Tweet IDs are required" }, { status: 400 })
    }

    // Get current tweets
    let tweets = await getTweets()

    // Find tweets to reject
    const tweetsToReject = tweets.filter(tweet => tweetIds.includes(tweet.id))

    if (tweetsToReject.length === 0) {
      return Response.json({ error: "No valid tweets found" }, { status: 404 })
    }

    // Store rejected tweets for duplicate checking
    for (const tweet of tweetsToReject) {
      try {
        await addRejectedTweet(tweet)
      } catch (error) {
        console.error(`Failed to store rejected tweet ${tweet.id}:`, error)
      }
    }

    // Update tweets status to rejected
    tweets = tweets.map(tweet =>
      tweetIds.includes(tweet.id) ? { ...tweet, status: "rejected" as const, rejectedAt: new Date().toISOString() } : tweet
    )

    await saveTweets(tweets)

    return Response.json({
      success: true,
      message: `${tweetsToReject.length} tweets rejected successfully and stored for duplicate checking`,
      tweetIds,
      rejectedCount: tweetsToReject.length
    })
  } catch (error) {
    console.error("Bulk reject error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}