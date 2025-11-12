import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { firebaseStorage } from "@/lib/firebase-storage"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { tweetIds } = await request.json()

    if (!tweetIds || !Array.isArray(tweetIds)) {
      return Response.json({ error: "Tweet IDs are required" }, { status: 400 })
    }

    // Get current tweets
    const tweets = await firebaseStorage.getAllTweets()
    const tweetsToReject = tweets.filter(tweet => tweetIds.includes(tweet.id))

    if (tweetsToReject.length === 0) {
      return Response.json({ error: "No valid tweets found" }, { status: 404 })
    }

    // Permanently delete tweets from storage
    let deletedCount = 0
    for (const tweetId of tweetIds) {
      try {
        const deleted = await firebaseStorage.deleteTweet(tweetId)
        if (deleted) {
          deletedCount++
        }
      } catch (error) {
        console.error(`Failed to delete tweet ${tweetId}:`, error)
      }
    }

    return Response.json({
      success: true,
      message: `${deletedCount} tweets permanently deleted`,
      tweetIds,
      deletedCount
    })
  } catch (error) {
    console.error("Bulk reject error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}