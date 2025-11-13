import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { firebaseApiKeysManager } from "@/lib/firebase-api-keys"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { count = 5 } = await request.json()

    // Get today's date for filtering recent AI news
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const fromDate = yesterday.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    console.log(`🧪 Testing real News API with key from Firebase...`)

    // Get News API key from Firebase
    let newsApiKey = null
    try {
      newsApiKey = await firebaseApiKeysManager.getActiveApiKey('news_api')
    } catch (keyError) {
      console.warn("⚠️ Failed to get NEWS_API_KEY from Firebase, trying environment variable...")
      newsApiKey = process.env.NEWS_API_KEY
    }

    if (!newsApiKey) {
      return Response.json({
        success: false,
        message: "NEWS_API_KEY not found in Firebase or environment variables",
        apiKeyStatus: "missing",
        help: "Please configure NEWS_API_KEY in Firebase api_keys collection"
      })
    }

    console.log(`✅ NEWS_API_KEY found (from Firebase)`)

    // Test API call with detailed logging
    const searchQuery = "artificial intelligence OR AI OR machine learning OR OpenAI OR ChatGPT OR Google AI OR Meta AI OR GPT OR LLM"
    const testUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&from=${fromDate}&to=${toDate}&pageSize=${count}&apiKey=${newsApiKey}`

    console.log(`📰 Testing News API URL: ${testUrl}`)

    const response = await fetch(testUrl)
    const data = await response.json()

    console.log(`📊 API Response Status: ${response.status}`)
    console.log(`📊 API Response Data:`, JSON.stringify(data, null, 2))

    if (response.ok) {
      return Response.json({
        success: true,
        message: "News API test successful",
        apiKeyStatus: "working",
        totalResults: data.totalResults,
        articlesFound: data.articles?.length || 0,
        articles: data.articles?.slice(0, 3) || [], // Return first 3 articles for preview
        apiResponse: {
          status: data.status,
          totalResults: data.totalResults,
          articlesCount: data.articles?.length || 0
        },
        testInfo: {
          query: searchQuery,
          fromDate,
          toDate,
          requestedCount: count
        }
      })
    } else {
      return Response.json({
        success: false,
        message: `News API test failed: ${data.message || 'Unknown error'}`,
        apiKeyStatus: "error",
        error: data,
        responseStatus: response.status,
        testInfo: {
          query: searchQuery,
          fromDate,
          toDate,
          requestedCount: count
        }
      })
    }

  } catch (error) {
    console.error("❌ Test real news error:", error)
    return Response.json({
      success: false,
      message: "Failed to test News API",
      error: error instanceof Error ? error.message : "Unknown error",
      apiKeyStatus: "error"
    }, { status: 500 })
  }
}