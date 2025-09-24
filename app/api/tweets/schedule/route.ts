import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { scheduleTweet, unscheduleTweet, getScheduledTweets } from "@/lib/tweet-scheduler"
import type { Tweet } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { action, tweet, tweetId, scheduledAt } = await request.json()

    if (!action) {
      return Response.json({ error: "Action is required" }, { status: 400 })
    }

    switch (action) {
      case 'schedule':
        if (!tweet || !scheduledAt) {
          return Response.json({ error: "Tweet and scheduled time are required for scheduling" }, { status: 400 })
        }

        const scheduledTime = new Date(scheduledAt)
        const now = new Date()

        if (scheduledTime <= now) {
          return Response.json({ error: "Scheduled time must be in the future" }, { status: 400 })
        }

        const tweetToSchedule: Tweet = {
          id: tweet.id || Math.random().toString(36).substring(2, 15),
          content: tweet.content,
          source: tweet.source || "manual",
          sourceUrl: tweet.sourceUrl || "",
          sourceTitle: tweet.sourceTitle || "Manual Creation",
          aiScore: tweet.aiScore || 8.0,
          status: "pending",
          createdAt: tweet.createdAt || new Date().toISOString(),
          scheduledAt: scheduledAt,
        }

        const success = scheduleTweet(tweetToSchedule, scheduledAt)

        if (success) {
          return Response.json({
            success: true,
            message: "Tweet scheduled successfully",
            tweet: tweetToSchedule
          })
        } else {
          return Response.json({
            error: "Failed to schedule tweet"
          }, { status: 500 })
        }

      case 'unschedule':
        if (!tweetId) {
          return Response.json({ error: "Tweet ID is required for unscheduling" }, { status: 400 })
        }

        const unscheduled = unscheduleTweet(tweetId)

        if (unscheduled) {
          return Response.json({
            success: true,
            message: "Tweet unscheduled successfully",
            tweetId
          })
        } else {
          return Response.json({
            error: "Tweet not found in scheduled list"
          }, { status: 404 })
        }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 })
    }

  } catch (error) {
    console.error("Schedule tweet error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const scheduledTweets = getScheduledTweets()

    return Response.json({
      success: true,
      scheduledTweets,
      count: scheduledTweets.length
    })

  } catch (error) {
    console.error("Get scheduled tweets error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}