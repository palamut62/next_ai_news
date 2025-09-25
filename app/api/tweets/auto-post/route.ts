import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { autoPostTweets } from "@/lib/tweet-scheduler"
import type { Tweet } from "@/lib/types"
import { logAPIEvent, logTweetEvent } from "@/lib/audit-logger"

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('auto_post_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { tweets, settings } = await request.json()

    if (!tweets || !Array.isArray(tweets)) {
      return Response.json({ error: "Tweets array is required" }, { status: 400 })
    }

    if (!settings) {
      return Response.json({ error: "Settings are required" }, { status: 400 })
    }

    // Validate settings
    const validSettings = {
      autoPost: Boolean(settings.autoPost),
      requireApproval: Boolean(settings.requireApproval),
      rateLimitDelay: Math.max(1, Number(settings.rateLimitDelay) || 5)
    }

    // Validate tweets
    const validatedTweets: Tweet[] = tweets.map(tweet => ({
      id: tweet.id || Math.random().toString(36).substring(2, 15),
      content: String(tweet.content || ""),
      source: tweet.source || "manual",
      sourceUrl: tweet.sourceUrl || "",
      sourceTitle: tweet.sourceTitle || "Auto-post",
      aiScore: Number(tweet.aiScore) || 8.0,
      status: tweet.status || "pending",
      createdAt: tweet.createdAt || new Date().toISOString(),
      postedAt: tweet.postedAt,
      engagement: tweet.engagement
    }))

    const results = await autoPostTweets(validatedTweets, validSettings)

    // Log auto-post results
    await logTweetEvent('tweet_posted', results.success > 0, request, {
      autoPost: true,
      successCount: results.success,
      failedCount: results.failed,
      errors: results.errors,
      userEmail: auth.email
    })

    return Response.json({
      success: true,
      message: `Auto-post completed: ${results.success} tweets posted, ${results.failed} failed`,
      ...results
    })

  } catch (error) {
    console.error("Auto-post error:", error)
    await logAPIEvent('auto_post_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      tweetsCount: tweets?.length
    })
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}