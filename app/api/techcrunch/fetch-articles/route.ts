import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { supabaseStorage } from "@/lib/supabase-storage"
import Parser from "rss-parser"

export interface TechCrunchArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  publishedAt: string
  author: string
  categories: string[]
  imageUrl?: string
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401, headers: CORS_HEADERS })
    // }

    const { hours = 24 } = await request.json()
    const parser = new Parser()

    console.log("Fetching TechCrunch RSS feed...")

    // Small fetch-with-timeout wrapper using parser.parseURL in a race
    async function fetchWithTimeout<T>(fetchFn: Promise<T>, timeout = 15000): Promise<T> {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RSS feed fetch timeout')), timeout))
      return Promise.race([fetchFn, timeoutPromise]) as Promise<T>
    }

    let feed: any
    try {
      feed = await fetchWithTimeout(parser.parseURL("https://techcrunch.com/feed/"), 15000)
      console.log("RSS feed fetched successfully, processing articles...")
    } catch (err) {
      console.error("❌ TechCrunch parser.parseURL failed:", err)
      throw err
    }

    // Filter articles from the last N hours
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)

    const articles: TechCrunchArticle[] = []

    for (const item of feed.items) {
      if (!item.title || !item.link || !item.pubDate) continue

      const publishedAt = new Date(item.pubDate)

      // Only include articles from the last N hours
      if (publishedAt < cutoffTime) continue

      // Check for duplicates before adding
      console.log(`Checking duplicate for: ${item.title}`)
      try {
        const isDuplicate = await supabaseStorage.isArticleRejected(item.title, item.link)
        if (isDuplicate) {
          console.log(`Skipping duplicate article: ${item.title}`)
          continue
        }
        console.log(`Article is not duplicate: ${item.title}`)
      } catch (error) {
        console.error(`Duplicate check failed for ${item.link}:`, error)
        // If duplicate check fails, still add the article to avoid missing content
      }

      // Generate a unique ID for the article
      const id = `tc_${publishedAt.getTime()}_${item.link.split('/').pop() || Math.random().toString(36).substring(2, 10)}`

      // Extract content from content or description
      let content = item.content || item.contentSnippet || item.description || ""

      // Clean up HTML tags if present
      content = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000) // Limit content length

      // Extract image URL from content if available
      let imageUrl: string | undefined
      const imgMatch = content.match(/<img[^>]+src="([^"]+)"/)
      if (imgMatch) {
        imageUrl = imgMatch[1]
      }

      // Extract categories
      const categories = item.categories || []

      // Extract author
      const author = item.creator || item.author || "TechCrunch Staff"

      const article: TechCrunchArticle = {
        id,
        title: item.title,
        description: item.contentSnippet || item.description || "",
        content,
        url: item.link,
        publishedAt: publishedAt.toISOString(),
        author,
        categories: Array.isArray(categories) ? categories : [],
        imageUrl
      }

      articles.push(article)
    }

    // Filter out rejected articles
    const finalArticles = []
    let rejectedCount = 0

    for (const article of articles) {
      const isRejected = await supabaseStorage.isArticleRejected(article.title, article.url)
      if (!isRejected) {
        finalArticles.push(article)
      } else {
        rejectedCount++
      }
    }

    // Sort by publication date (newest first)
    finalArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    console.log(`Found ${articles.length} articles from the last ${hours} hours`)
    console.log(`Filtered out ${rejectedCount} rejected articles`)

    return Response.json({
      success: true,
      articles: finalArticles,
      totalFound: finalArticles.length,
      rejectedCount: rejectedCount,
      timeRange: `${hours}h`,
      fetchedAt: new Date().toISOString()
    }, { headers: CORS_HEADERS })

  } catch (error) {
    console.error("Fetch TechCrunch articles error:", error)
    return Response.json({
      error: "Failed to fetch articles",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}