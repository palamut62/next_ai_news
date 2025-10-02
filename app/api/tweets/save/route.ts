import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const body = await request.json()
    const { content, source, sourceUrl, sourceTitle, aiScore, status } = body

    if (!content || content.trim().length === 0) {
      return Response.json({ error: "Tweet content is required" }, { status: 400 })
    }

    if (content.length > 280) {
      return Response.json({ error: "Tweet too long (max 280 characters)" }, { status: 400 })
    }

    // Forward to the main tweets API with save action
    const tweetsResponse = await fetch('http://localhost:3001/api/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        action: 'save',
        content,
        source: source || "manual",
        sourceUrl: sourceUrl || "",
        sourceTitle: sourceTitle || "Manual Creation",
        aiScore: aiScore || 8.0,
        status: status || "pending"
      })
    })

    if (!tweetsResponse.ok) {
      const errorData = await tweetsResponse.json()
      return Response.json(errorData, { status: tweetsResponse.status })
    }

    const data = await tweetsResponse.json()
    return Response.json(data)

  } catch (error) {
    console.error("Save tweet error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}