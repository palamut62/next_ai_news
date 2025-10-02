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

    // Import the generate tweets logic using existing API
    console.log("🐦 Calling generate-tweets API...")
    const generateTweetsResponse = await fetch("http://77.37.54.38:3001/api/news/generate-tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles })
    })

    console.log(`📊 generate-tweets response status: ${generateTweetsResponse.status}`)

    if (!generateTweetsResponse.ok) {
      throw new Error(`Failed to generate tweets: ${generateTweetsResponse.status}`)
    }

    const generateTweetsText = await generateTweetsResponse.text()
    console.log("📝 generate-tweets response text (first 200 chars):", generateTweetsText.slice(0, 200))

    let tweetResult
    try {
      tweetResult = JSON.parse(generateTweetsText)
    } catch (parseError) {
      console.error("Failed to parse generate-tweets response:", parseError)
      console.error("Response text:", generateTweetsText.slice(0, 500))
      throw new Error("Invalid JSON response from generate-tweets API")
    }

    if (!tweetResult.success || !tweetResult.tweets || tweetResult.tweets.length === 0) {
      return Response.json({
        success: false,
        message: "Failed to generate tweets from articles",
        articlesFound: articles.length,
        tweetsGenerated: 0
      })
    }

    const { tweets } = tweetResult
    console.log(`✅ Successfully generated ${tweets.length} tweets`)

    // Step 3: Save tweets to storage
    console.log("💾 Step 3: Saving tweets to storage...")

    // Import save tweets logic using existing API
    const saveTweetsResponse = await fetch("http://77.37.54.38:3001/api/news/save-tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweets })
    })

    if (!saveTweetsResponse.ok) {
      throw new Error(`Failed to save tweets: ${saveTweetsResponse.status}`)
    }

    const saveTweetsText = await saveTweetsResponse.text()
    let saveResult
    try {
      saveResult = JSON.parse(saveTweetsText)
    } catch (parseError) {
      console.error("Failed to parse save-tweets response:", parseError)
      console.error("Response text:", saveTweetsText.slice(0, 500))
      throw new Error("Invalid JSON response from save-tweets API")
    }

    if (!saveResult.success) {
      return Response.json({
        success: false,
        message: "Failed to save tweets",
        articlesFound: articles.length,
        tweetsGenerated: tweets.length,
        tweetsSaved: 0
      })
    }

    const { saved, savedTweets } = saveResult
    console.log(`✅ Successfully saved ${saved} tweets`)

    // Step 4: Optional auto-post based on settings
    let autoPostResult: any = null
    if (saved > 0) {
      console.log("🚀 Step 4: Checking auto-post settings...")

      try {
        // Get settings using existing API
        const settingsResponse = await fetch("http://77.37.54.38:3001/api/settings")
        let settings = null
        if (settingsResponse.ok) {
          const settingsText = await settingsResponse.text()
          try {
            settings = JSON.parse(settingsText)
          } catch (parseError) {
            console.error("Failed to parse settings:", parseError)
          }
        }

        const automation = settings?.automation || {
          autoPost: true,
          requireApproval: true,
          rateLimitDelay: 30
        }

        if (automation && automation.autoPost) {
          console.log("📤 Auto-post is enabled, processing tweets...")

          const eligibleTweets = savedTweets.filter((tweet: any) =>
            automation.requireApproval ? tweet.approved : true
          )

          if (eligibleTweets.length > 0) {
            // Use existing auto-post API
            const autoPostResponse = await fetch("http://77.37.54.38:3001/api/tweets/auto-post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tweets: eligibleTweets, settings: automation })
            })

            if (autoPostResponse.ok) {
              const autoPostText = await autoPostResponse.text()
              try {
                autoPostResult = JSON.parse(autoPostText)
              } catch (parseError) {
                console.error("Failed to parse auto-post response:", parseError)
                autoPostResult = { posted: 0, error: "Failed to parse auto-post response" }
              }
              console.log(`✅ Auto-post completed: ${autoPostResult?.posted || 0} tweets posted`)
            } else {
              console.error("❌ Auto-post API failed:", autoPostResponse.status)
              autoPostResult = { posted: 0, error: `Auto-post API failed: ${autoPostResponse.status}` }
            }
          } else {
            console.log("ℹ️ No eligible tweets for auto-post")
            autoPostResult = { posted: 0, message: "No eligible tweets for auto-post" }
          }
        } else {
          console.log("ℹ️ Auto-post is disabled")
          autoPostResult = { posted: 0, message: "Auto-post is disabled" }
        }
      } catch (autoErr) {
        console.error("❌ Error in auto-post flow:", autoErr)
        autoPostResult = {
          posted: 0,
          error: autoErr instanceof Error ? autoErr.message : String(autoErr)
        }
      }
    }

    // Log successful processing
    await logAPIEvent('process_news_success', true, request, {
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      tweetsPosted: autoPostResult?.posted || 0,
      isRealData,
      userEmail: 'test-user@example.com'
    })

    return Response.json({
      success: true,
      message: "Successfully processed AI news and generated tweets",
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      tweetsPosted: autoPostResult?.posted || 0,
      autoPostResult,
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