import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { checkAndFilterNewsArticles, markNewsArticlesProcessed, newsDuplicateDetector } from "@/lib/news-duplicate-detector"
import { logAPIEvent } from "@/lib/audit-logger"

// Simple fetch with timeout helper
async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = 20000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

interface NewsArticle {
  title: string
  description: string
  url: string
  urlToImage: string | null
  publishedAt: string
  source: {
    name: string
  }
}

export async function POST(request: NextRequest) {
  let count = 10
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('fetch_news_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { count: requestedCount = 10 } = await request.json()
    count = requestedCount

    // Get today's date for filtering recent AI news
    const today = new Date()
    const oneMonthAgo = new Date(today)
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

    // NewsAPI requires specific date format and valid range
    const fromDate = oneMonthAgo.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]

    console.log(`📅 Date range: ${fromDate} to ${toDate}`)

    let articles: NewsArticle[] = []

    // Try NewsAPI first - use the real API key from .env
    if (process.env.NEWS_API_KEY) {
      try {
        // Enhanced AI-related search terms for better news coverage
        const searchQuery = "artificial intelligence OR AI OR machine learning OR deep learning OR neural networks OR ChatGPT OR OpenAI OR Google AI OR Microsoft AI OR Meta AI OR Anthropic OR GPT OR LLM OR large language model OR generative AI OR automation OR robotics OR computer vision OR natural language processing"

        // Test with a shorter date range first to avoid API limitations
        const testFromDate = new Date(today)
        testFromDate.setDate(testFromDate.getDate() - 7) // Last 7 days only

        const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&from=${testFromDate.toISOString().split('T')[0]}&to=${toDate}&pageSize=${count}&apiKey=${process.env.NEWS_API_KEY}`

        console.log(`📰 Fetching real AI news from: ${newsApiUrl}`)
        try {
          const response = await fetchWithTimeout(newsApiUrl, {}, 20000)
          const text = await response.text()
          let data: any = {}
          try { data = JSON.parse(text) } catch { /* ignore non-json */ }

          if (response.ok && data.articles && data.articles.length > 0) {
            articles = data.articles.slice(0, count)
            console.log(`✅ Successfully fetched ${articles.length} real AI news articles`)
          } else {
            console.error(`❌ NewsAPI response status: ${response.status} ${response.statusText}`)
            console.error('❌ NewsAPI body (first 1000 chars):', text.slice(0, 1000))
          }
        } catch (newsApiError) {
          console.error("❌ NewsAPI failed:", newsApiError)
        }
      } catch (newsApiError) {
        console.error("❌ NewsAPI failed:", newsApiError)
      }
    } else {
      console.error("❌ NEWS_API_KEY not found in environment variables")
      return Response.json({
        success: false,
        error: "NEWS_API_KEY not configured",
        message: "Please add NEWS_API_KEY to your environment variables"
      }, { status: 500 })
    }

    // If no real articles found from API, try TechCrunch RSS feed for recent AI news
    if (articles.length === 0) {
      try {
        console.log("🔄 Trying TechCrunch RSS feed for recent AI news...")
        const rssUrl = 'https://techcrunch.com/category/artificial-intelligence/feed/'
        const techcrunchRSS = await fetchWithTimeout(rssUrl, {}, 25000)
        const rssText = await techcrunchRSS.text()

        // Simple and robust RSS parsing without relying on DOMParser (works in Node)
        const itemBlocks = Array.from(rssText.matchAll(/<item[\s\S]*?<\/item>/g)).map(m => m[0])

        const now = new Date()
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        for (let i = 0; i < Math.min(itemBlocks.length, count); i++) {
          const itemText = itemBlocks[i]

          const titleMatch = itemText.match(/<title>([\s\S]*?)<\/title>/i)
          const descriptionMatch = itemText.match(/<description>([\s\S]*?)<\/description>/i)
          const linkMatch = itemText.match(/<link>([\s\S]*?)<\/link>/i)
          const pubDateMatch = itemText.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)

          const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : ''
          let description = descriptionMatch ? descriptionMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : ''
          const link = linkMatch ? linkMatch[1].trim() : ''
          const pubDate = pubDateMatch ? pubDateMatch[1].trim() : ''

          // Remove HTML tags from description
          description = description.replace(/<[^>]*>/g, '').trim()

          // Check if article is from last 24 hours
          const articleDate = pubDate ? new Date(pubDate) : new Date()
          if (isNaN(articleDate.getTime())) continue

          if (articleDate >= twentyFourHoursAgo && title.toLowerCase().includes('ai')) {
            articles.push({
              title,
              description,
              url: link,
              urlToImage: null,
              publishedAt: articleDate.toISOString(),
              source: { name: 'TechCrunch' }
            })
          }
        }

        console.log(`✅ Found ${articles.length} recent AI articles from TechCrunch RSS`)
      } catch (rssError) {
        console.error("❌ TechCrunch RSS failed:", rssError)
        console.log("⚠️ No real AI news articles found in the last 24 hours")
        return Response.json({
          success: true,
          articles: [],
          count: 0,
          fetchedAt: new Date().toISOString(),
          isRealData: true,
          message: "No AI news articles found in the last 24 hours (NewsAPI limitation: requires paid plan for recent articles)"
        })
      }
    }

    // Enhanced filtering for quality AI news articles with duplicate detection
    const filteredArticles = []
    let duplicatesCount = 0

    for (const article of articles) {
      // Basic content validation
      if (!article.title || !article.description) continue
      if (article.title.length < 15 || article.description.length < 30) continue

      // Filter out unwanted content types
      const title = article.title.toLowerCase()
      const description = article.description.toLowerCase()

      // Exclude non-AI content
      const excludeKeywords = [
        'weather', 'sports', 'football', 'basketball', 'cricket', 'tennis',
        'stock market', 'cryptocurrency', 'bitcoin', 'election', 'politics',
        'recipe', 'cooking', 'travel', 'fashion', 'celebrity', 'movie',
        'music album', 'game review', 'iphone release', 'samsung galaxy'
      ]

      const hasExcludedKeyword = excludeKeywords.some(keyword =>
        title.includes(keyword) || description.includes(keyword)
      )

      if (hasExcludedKeyword) continue

      // Prioritize AI-related content
      const aiKeywords = [
        'artificial intelligence', 'ai', 'machine learning', 'deep learning',
        'neural network', 'chatgpt', 'openai', 'gpt', 'llm', 'large language model',
        'generative ai', 'automation', 'robotics', 'computer vision', 'nlp',
        'natural language processing', 'anthropic', 'claude', 'gemini', 'bard',
        'meta ai', 'microsoft ai', 'automation', 'algorithm', 'predictive'
      ]

      const hasAIKeyword = aiKeywords.some(keyword =>
        title.includes(keyword) || description.includes(keyword)
      )

      if (!hasAIKeyword) continue

      // Check for duplicates using the new advanced system
      const duplicateCheck = await newsDuplicateDetector.isDuplicate({
        title: article.title,
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        description: article.description
      }, {
        titleSimilarity: 0.8,  // 80% title similarity threshold
        contentSimilarity: 0.6, // 60% content similarity threshold
        timeWindow: 48 // 48 hours time window
      })

      if (duplicateCheck.isDuplicate) {
        duplicatesCount++
        console.log(`🔄 Duplicate detected: "${article.title.substring(0, 50)}..." (${duplicateCheck.reason}, similarity: ${(duplicateCheck.similarity * 100).toFixed(1)}%)`)
        continue
      }

      filteredArticles.push(article)
    }

    console.log(`📊 Filtered ${articles.length} articles down to ${filteredArticles.length} unique articles (duplicates skipped: ${duplicatesCount})`)

    // Mark processed articles to prevent future duplicates
    if (filteredArticles.length > 0) {
      try {
        await markNewsArticlesProcessed(filteredArticles.map(article => ({
          title: article.title,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt,
          description: article.description
        })))
        console.log(`✅ Marked ${filteredArticles.length} articles as processed for duplicate detection`)
      } catch (markError) {
        console.error('⚠️ Failed to mark articles as processed:', markError)
      }
    }

    // Log successful fetch
    await logAPIEvent('fetch_news_success', true, request, {
      totalArticles: articles.length,
      uniqueArticles: filteredArticles.length,
      duplicatesSkipped: duplicatesCount,
      sources: [...new Set(filteredArticles.map(a => a.source.name))],
      userEmail: auth.email
    })

    return Response.json({
      success: true,
      articles: filteredArticles,
      count: filteredArticles.length,
      duplicatesSkipped: duplicatesCount,
      fetchedAt: new Date().toISOString(),
      isRealData: process.env.NEWS_API_KEY ? true : false
    })

  } catch (error) {
    console.error("Fetch AI news error:", error)
    await logAPIEvent('fetch_news_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestedCount: count
    })
    return Response.json({ error: "Failed to fetch AI news" }, { status: 500 })
  }
}