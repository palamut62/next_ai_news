import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { supabaseStorage } from "@/lib/supabase-storage"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const includeActivity = searchParams.get('includeActivity') === 'true'

    // Get all tweets from Supabase
    const allTweets = await supabaseStorage.getAllTweets()

    // Calculate statistics from Supabase data
    const totalProcessed = allTweets.length
    const totalPosted = allTweets.filter(t => t.status === 'posted').length
    const totalDeleted = allTweets.filter(t => t.status === 'rejected').length
    const totalDuplicates = 0 // TODO: Implement duplicate tracking in Supabase

    // Calculate source distribution
    const bySource: Record<string, any> = {}
    allTweets.forEach(tweet => {
      if (!bySource[tweet.source]) {
        bySource[tweet.source] = {
          processed: 0,
          posted: 0,
          deleted: 0,
          duplicates: 0
        }
      }
      bySource[tweet.source].processed++
      if (tweet.status === 'posted') bySource[tweet.source].posted++
      if (tweet.status === 'rejected') bySource[tweet.source].deleted++
    })

    // Calculate rejected statistics
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const rejectedToday = allTweets.filter(t =>
      t.status === 'rejected' && new Date(t.rejectedAt || t.createdAt) >= today
    ).length
    const rejectedThisWeek = allTweets.filter(t =>
      t.status === 'rejected' && new Date(t.rejectedAt || t.createdAt) >= weekAgo
    ).length
    const rejectedThisMonth = allTweets.filter(t =>
      t.status === 'rejected' && new Date(t.rejectedAt || t.createdAt) >= monthAgo
    ).length

    // Generate recent activity data
    let activity = null
    if (includeActivity) {
      const recentDays: Record<string, any> = {}

      // Initialize last N days
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        recentDays[dateStr] = {
          processed: 0,
          posted: 0,
          deleted: 0
        }
      }

      // Fill with actual data
      allTweets.forEach(tweet => {
        const tweetDate = new Date(tweet.createdAt).toISOString().split('T')[0]
        if (recentDays[tweetDate]) {
          recentDays[tweetDate].processed++
          if (tweet.status === 'posted') recentDays[tweetDate].posted++
          if (tweet.status === 'rejected') recentDays[tweetDate].deleted++
        }
      })

      activity = {
        recentDays,
        summary: {
          totalPosted,
          totalDeleted,
          totalDuplicates,
          topSources: Object.entries(bySource)
            .sort(([,a], [,b]) => b.posted - a.posted)
            .slice(0, 5)
            .map(([source, stats]) => ({ source, ...stats }))
        }
      }
    }

    const response = {
      success: true,
      stats: {
        totalProcessed,
        totalPosted,
        totalDeleted,
        totalDuplicates,
        totalRejected: totalDeleted,
        rejectedToday,
        rejectedThisWeek,
        rejectedThisMonth,
        bySource,
        lastUpdated: new Date().toISOString()
      }
    }

    // Include recent activity if requested
    if (includeActivity) {
      response.activity = activity
    }

    return Response.json(response)

  } catch (error) {
    console.error("Get tweet stats error:", error)
    return Response.json({
      error: "Failed to get tweet statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}