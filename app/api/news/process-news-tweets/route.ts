import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { logAPIEvent } from "@/lib/audit-logger"
import { fetchAINewsArticles } from "@/app/api/news/fetch-ai-news/route"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // const auth = await checkAuth(request)
    // if (!auth.authenticated) {
    //   await logAPIEvent('process_news_auth_failure', false, request, {
    //     url: request.url,
    //     method: request.method
    //   })
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { count = 10 } = await request.json()

    console.log(`🚀 Starting process-news-tweets with count: ${count}`)

    // Step 1: Fetch AI news articles using direct function call
    console.log("📰 Step 1: Fetching AI news articles...")
    const fetchResult = await fetchAINewsArticles(count)

    if (!fetchResult.success || !fetchResult.articles || fetchResult.articles.length === 0) {
      return Response.json({
        success: false,
        message: "No AI news articles found",
        articlesFound: 0
      })
    }

    const { articles, isRealData } = fetchResult
    console.log(`✅ Successfully fetched ${articles.length} articles`)

    // Step 2: Generate tweets from those articles
    console.log("🐦 Step 2: Generating tweets from articles...")

    // Use generate-tweets API directly
    const generateTweetsResponse = await fetch("http://77.37.54.38:3001/api/news/generate-tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles })
    })

    if (!generateTweetsResponse.ok) {
      console.error(`❌ generate-tweets API failed: ${generateTweetsResponse.status}`)
      return Response.json({
        success: false,
        message: "Failed to generate tweets from articles",
        articlesFound: articles.length,
        tweetsGenerated: 0
      })
    }

    const generateTweetsText = await generateTweetsResponse.text()
    let tweetResult
    try {
      tweetResult = JSON.parse(generateTweetsText)
    } catch (parseError) {
      console.error("Failed to parse generate-tweets response:", parseError)
      console.error("Response text:", generateTweetsText.slice(0, 500))
      return Response.json({
        success: false,
        message: "Invalid response from generate-tweets API",
        articlesFound: articles.length,
        tweetsGenerated: 0
      })
    }

    if (!tweetResult.success || !tweetResult.tweets || tweetResult.tweets.length === 0) {
      return Response.json({
        success: false,
        message: "No tweets generated from articles",
        articlesFound: articles.length,
        tweetsGenerated: 0
      })
    }

    const { tweets } = tweetResult
    console.log(`✅ Successfully generated ${tweets.length} tweets`)

    // Step 3: Save tweets to storage (simplified)
    console.log("💾 Step 3: Saving tweets to storage...")

    const saveTweetsResponse = await fetch("http://77.37.54.38:3001/api/news/save-tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweets })
    })

    let saved = 0
    let savedTweets = tweets

    if (saveTweetsResponse.ok) {
      const saveTweetsText = await saveTweetsResponse.text()
      try {
        const saveResult = JSON.parse(saveTweetsText)
        saved = saveResult.saved || 0
        savedTweets = saveResult.savedTweets || tweets
        console.log(`✅ Successfully saved ${saved} tweets`)
      } catch (parseError) {
        console.error("Failed to parse save-tweets response:", parseError)
        console.log("⚠️ Continuing without successful save confirmation")
      }
    } else {
      console.error("❌ save-tweets API failed:", saveTweetsResponse.status)
      console.log("⚠️ Continuing without successful save")
    }

    // Log successful processing
    await logAPIEvent('process_news_success', true, request, {
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      isRealData,
      userEmail: 'test-user@example.com'
    })

    return Response.json({
      success: true,
      message: "Successfully processed AI news and generated tweets",
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      isRealData,
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Process news tweets error:", error)
    await logAPIEvent('process_news_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestedCount: 10
    })

    return Response.json({
      success: false,
      error: "Failed to process news tweets",
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}