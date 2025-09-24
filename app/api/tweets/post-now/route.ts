import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { postTextTweetV2 } from "@/lib/twitter-v2-client"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { content, source, sourceUrl, sourceTitle, aiScore } = await request.json()

    if (!content || content.trim().length === 0) {
      return Response.json({ error: "Tweet content is required" }, { status: 400 })
    }

    if (content.length > 280) {
      return Response.json({ error: "Tweet too long (max 280 characters)" }, { status: 400 })
    }

    // Twitter v2 API ile tweet at
  const twitterResult = await postTextTweetV2(content, sourceUrl)

    if (!twitterResult.success) {
      return Response.json({
        error: `Failed to post tweet: ${twitterResult.error}`,
        details: twitterResult.details || null
      }, { status: 500 })
    }

    const postedTweet = {
      id: twitterResult.tweet_id || Date.now().toString(),
      content,
      source: source || "manual",
      sourceUrl: sourceUrl || "",
      sourceTitle: sourceTitle || "Manual Creation",
      aiScore: aiScore || 8.0,
      status: "posted",
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      engagement: {
        likes: 0,
        retweets: 0,
        replies: 0
      }
    }

    return Response.json({
      success: true,
      message: "Tweet posted successfully!",
      tweet: postedTweet,
      twitterUrl: twitterResult.url
    })

  } catch (error) {
    console.error("Post tweet error:", error)
    return Response.json({ error: "Failed to post tweet" }, { status: 500 })
  }
}