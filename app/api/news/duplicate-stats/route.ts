import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { newsDuplicateDetector } from "@/lib/news-duplicate-detector"
import { logAPIEvent } from "@/lib/audit-logger"

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('duplicate_stats_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const stats = await newsDuplicateDetector.getStats()

    await logAPIEvent('duplicate_stats_access', true, request, {
      userEmail: auth.email,
      statsSummary: {
        totalProcessed: stats.totalProcessed,
        duplicatesDetected: stats.duplicatesDetected,
        uniqueSources: stats.uniqueSources.length
      }
    })

    return Response.json({
      success: true,
      stats,
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Get duplicate stats error:", error)
    await logAPIEvent('duplicate_stats_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return Response.json({ error: "Failed to get duplicate stats" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('duplicate_cleanup_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { olderThanDays = 30 } = await request.json()

    if (typeof olderThanDays !== 'number' || olderThanDays < 1) {
      return Response.json({ error: "Invalid olderThanDays parameter" }, { status: 400 })
    }

    const cleanedCount = await newsDuplicateDetector.cleanup(olderThanDays)

    await logAPIEvent('duplicate_cleanup', true, request, {
      olderThanDays,
      cleanedCount,
      userEmail: auth.email
    })

    return Response.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old articles older than ${olderThanDays} days`
    })

  } catch (error) {
    console.error("Cleanup duplicate data error:", error)
    await logAPIEvent('duplicate_cleanup_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return Response.json({ error: "Failed to cleanup duplicate data" }, { status: 500 })
  }
}