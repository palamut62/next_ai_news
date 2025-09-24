import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { getTweetStats, getRecentActivity } from "@/lib/tweet-storage"

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const includeActivity = searchParams.get('includeActivity') === 'true'

    // Get basic statistics
    const stats = await getTweetStats()

    const response: any = {
      success: true,
      stats: {
        totalProcessed: stats.totalProcessed,
        totalPosted: stats.totalPosted,
        totalDeleted: stats.totalDeleted,
        totalDuplicates: stats.totalDuplicates,
        bySource: stats.bySource,
        lastUpdated: stats.lastUpdated
      }
    }

    // Include recent activity if requested
    if (includeActivity) {
      const activity = await getRecentActivity(days)
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