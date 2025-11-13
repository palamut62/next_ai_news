import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { logAPIEvent } from "@/lib/audit-logger"
import fs from "fs/promises"
import path from "path"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"

const DEFAULT_SETTINGS = {
  automation: {
    enabled: true,
    checkInterval: 2,
    maxArticlesPerCheck: 10,
    minAiScore: 7,
    autoPost: true,
    requireApproval: true,
    rateLimitDelay: 30,
  },
  github: {
    enabled: true,
    languages: ["JavaScript", "Python", "TypeScript"],
    timeRange: "weekly",
    maxRepos: 5,
    minStars: 100,
  },
  notifications: {
    telegram: { enabled: false, botToken: "", chatId: "" },
    email: {
      enabled: false,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      username: "",
      password: "",
      fromEmail: "",
      toEmail: "",
    },
  },
  twitter: {
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  },
  ai: {
    provider: "gemini",
    apiKey: "",
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 280,
  },
  apiUrl: "http://localhost:3000"
}

// Function to get settings from Firebase, fallback to file
async function getSettings() {
  try {
    // Try to get from Firebase
    if (db) {
      const settingsRef = collection(db, "settings")
      const q = query(settingsRef, where("type", "==", "app_settings"))
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const settingsDoc = snapshot.docs[0]
        console.log("✅ Settings loaded from Firebase")
        return settingsDoc.data()
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to load settings from Firebase:", error)
  }

  // Fallback to file
  try {
    const settingsFile = path.join(process.cwd(), "data", "settings.json")
    const settingsData = await fs.readFile(settingsFile, "utf8")
    console.log("✅ Settings loaded from file")
    return JSON.parse(settingsData)
  } catch (error) {
    console.log("⚠️ Using default settings")
    return DEFAULT_SETTINGS
  }
}

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

    // Get server URL from settings
    const settings = await getSettings()
    const serverUrl = settings.apiUrl || (
      process.env.NODE_ENV === 'production'
        ? 'http://77.37.54.38:3000'
        : 'http://localhost:3000'
    )

    // Step 1: Fetch real AI news articles
    console.log("📰 Step 1: Fetching real AI news articles...")

    const fetchAINewsResponse = await fetch(`${serverUrl}/api/news/fetch-ai-news`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    })

    if (!fetchAINewsResponse.ok) {
      console.error(`❌ fetch-ai-news API failed: ${fetchAINewsResponse.status}`)
      return Response.json({
        success: false,
        message: "Failed to fetch real AI news articles",
        articlesFound: 0,
        tweetsGenerated: 0
      })
    }

    const fetchNewsText = await fetchAINewsResponse.text()
    let fetchResult
    try {
      fetchResult = JSON.parse(fetchNewsText)
    } catch (parseError) {
      console.error("Failed to parse fetch-ai-news response:", parseError)
      console.error("Response text:", fetchNewsText.slice(0, 500))
      return Response.json({
        success: false,
        message: "Invalid response from fetch-ai-news API",
        articlesFound: 0,
        tweetsGenerated: 0
      })
    }

    if (!fetchResult.success || !fetchResult.articles || fetchResult.articles.length === 0) {
      console.log(`No articles found: ${fetchResult.message || 'Unknown reason'}`)
      return Response.json({
        success: false,
        message: "No AI news articles found",
        articlesFound: 0,
        tweetsGenerated: 0
      })
    }

    const articles = fetchResult.articles
    console.log(`✅ Successfully fetched ${articles.length} real AI news articles`)

    // Step 2: Generate tweets from those articles
    console.log("🐦 Step 2: Generating tweets from articles...")

    const generateTweetsResponse = await fetch(`${serverUrl}/api/news/generate-tweets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
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

    const saveTweetsResponse = await fetch(`${serverUrl}/api/news/save-tweets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweets }),
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
      isRealData: false,
      userEmail: 'test-user@example.com'
    })

    return Response.json({
      success: true,
      message: "Successfully processed AI news and generated tweets",
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      isRealData: false,
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