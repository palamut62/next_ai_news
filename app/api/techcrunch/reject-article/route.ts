import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { addRejectedArticle } from "@/lib/rejected-articles-tracker"
import { logAPIEvent } from "@/lib/audit-logger"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // const auth = await checkAuth(request)
    // if (!auth.authenticated) {
    //   await logAPIEvent('reject_article_auth_failure', false, request, {
    //     url: request.url,
    //     method: request.method
    //   })
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    let article
    try {
      const body = await request.json()
      article = body.article
    } catch (jsonError) {
      return Response.json({ error: "Invalid JSON data" }, { status: 400 })
    }

    if (!article || !article.title || !article.url) {
      return Response.json({ error: "Article with title and URL is required" }, { status: 400 })
    }

    // Add to rejected articles
    await addRejectedArticle({
      title: article.title,
      url: article.url,
      source: article.source || 'techcrunch',
      publishedAt: article.publishedAt || new Date().toISOString(),
      description: article.description,
      reason: 'user_rejected'
    })

    await logAPIEvent('article_rejected', true, request, {
      articleTitle: article.title,
      articleUrl: article.url,
      source: article.source || 'techcrunch',
      userEmail: 'test-user@example.com'
    })

    return Response.json({
      success: true,
      message: "Article rejected successfully",
      articleTitle: article.title
    })

  } catch (error) {
    console.error("Reject article error:", error)
    await logAPIEvent('reject_article_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      articleTitle: article?.title
    })
    return Response.json({ error: "Failed to reject article" }, { status: 500 })
  }
}