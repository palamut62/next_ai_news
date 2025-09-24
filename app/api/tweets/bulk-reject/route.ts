import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { tweetIds } = await request.json()

    if (!tweetIds || !Array.isArray(tweetIds)) {
      return Response.json({ error: "Tweet IDs are required" }, { status: 400 })
    }

    // Here you would update your database
    // For now, we'll just return success

    return Response.json({
      success: true,
      message: `${tweetIds.length} tweets rejected successfully`,
      tweetIds
    })
  } catch (error) {
    console.error("Bulk reject error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}