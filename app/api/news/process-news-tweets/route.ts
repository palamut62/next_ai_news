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

    // Import the generate tweets logic directly
    const { generateTweetsFromArticles } = await import("@/lib/tweet-generator")

    const tweetResult = await generateTweetsFromArticles(articles, {
      maxTweetsPerArticle: 2,
      tone: "professional",
      includeHashtags: true
    })

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

    // Import save tweets logic directly
    const { saveTweetsToStorage } = await import("@/lib/storage")

    const saveResult = await saveTweetsToStorage(tweets)

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
        // Get settings directly without API call
        const { getSettings } = await import("@/lib/settings")
        const settings = await getSettings()

        const automation = settings?.automation || {
          autoPost: true,
          requireApproval: true,
          rateLimitDelay: 30
        }

        if (automation && automation.autoPost) {
          console.log("📤 Auto-post is enabled, processing tweets...")

          // Import auto-post logic directly
          const { postTweetsToTwitter } = await import("@/lib/twitter-api")

          const eligibleTweets = savedTweets.filter((tweet: any) =>
            automation.requireApproval ? tweet.approved : true
          )

          if (eligibleTweets.length > 0) {
            autoPostResult = await postTweetsToTwitter(eligibleTweets, {
              rateLimitDelay: automation.rateLimitDelay || 30
            })
            console.log(`✅ Auto-post completed: ${autoPostResult.posted || 0} tweets posted`)
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