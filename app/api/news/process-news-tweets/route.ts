import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { count = 10 } = await request.json()

    // Step 1: Fetch AI news articles
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'http://localhost:3000')
    const fetchResponse = await fetch(`${baseUrl}/api/news/fetch-ai-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ count })
    })

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch news: ${fetchResponse.status}`)
    }

    const { articles, isRealData } = await fetchResponse.json()

    if (!articles || articles.length === 0) {
      return Response.json({
        success: false,
        message: "No AI news articles found",
        articlesFound: 0
      })
    }

    // Step 2: Generate tweets from articles
    const generateResponse = await fetch(`${baseUrl}/api/news/generate-tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ articles })
    })

    if (!generateResponse.ok) {
      throw new Error(`Failed to generate tweets: ${generateResponse.status}`)
    }

    const { tweets } = await generateResponse.json()

    if (!tweets || tweets.length === 0) {
      return Response.json({
        success: false,
        message: "Failed to generate tweets from articles",
        articlesFound: articles.length,
        tweetsGenerated: 0
      })
    }

    // Step 3: Save tweets to storage
    const saveResponse = await fetch(`${baseUrl}/api/news/save-tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ tweets })
    })

    if (!saveResponse.ok) {
      throw new Error(`Failed to save tweets: ${saveResponse.status}`)
    }

    const { saved, savedTweets } = await saveResponse.json()

    return Response.json({
      success: true,
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      savedTweets,
      isRealData,
      processedAt: new Date().toISOString(),
      message: `Successfully processed ${saved} AI news tweets from ${articles.length} articles`
    })

  } catch (error) {
    console.error("Process news tweets error:", error)
    return Response.json({
      error: "Failed to process news tweets",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}