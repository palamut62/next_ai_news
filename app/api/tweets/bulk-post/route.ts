import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { postTweetToTwitter } from "@/lib/twitter-client"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { tweetIds, tweets } = await request.json()

    if (!tweetIds || !Array.isArray(tweetIds)) {
      return Response.json({ error: "Tweet IDs are required" }, { status: 400 })
    }

    if (!tweets || !Array.isArray(tweets)) {
      return Response.json({ error: "Tweet data is required" }, { status: 400 })
    }

    // Post tweets to Twitter API
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const tweetId of tweetIds) {
      try {
        // Find the tweet content from the provided tweets array
        const tweetData = tweets?.find((t: any) => t.id === tweetId)

        if (!tweetData || !tweetData.content) {
          failureCount++
          results.push({
            tweetId,
            success: false,
            error: "Tweet content not found"
          })
          continue
        }

        const result = await postTweetToTwitter(tweetData.content)

        if (result.success) {
          successCount++
          results.push({
            tweetId,
            success: true,
            twitterId: result.tweetId,
            postedAt: new Date().toISOString()
          })
        } else {
          failureCount++
          results.push({
            tweetId,
            success: false,
            error: result.error
          })
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        failureCount++
        results.push({
          tweetId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return Response.json({
      success: true,
      message: `${successCount} tweets posted successfully, ${failureCount} failed`,
      results,
      summary: {
        total: tweetIds.length,
        successCount,
        failureCount
      }
    })
  } catch (error) {
    console.error("Bulk post error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}