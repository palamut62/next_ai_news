import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { logAPIEvent } from "@/lib/audit-logger"

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authenticated) {
      await logAPIEvent('process_news_auth_failure', false, request, {
        url: request.url,
        method: request.method
      })
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { count = 10 } = await request.json()

    // Step 1: Fetch AI news articles
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-news-tweet-app.vercel.app'
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

    // After saving tweets, optionally trigger auto-post based on settings
    let autoPostResult: any = null
    try {
      if (saved > 0) {
        console.log('Fetching settings to determine auto-post behavior')
        const settingsRes = await fetch(`${baseUrl}/api/settings`, {
          method: 'GET',
          headers: { 'Cookie': request.headers.get('cookie') || '' }
        })

        let settings: any = null
        if (settingsRes.ok) {
          settings = await settingsRes.json()
        }

        const automation = settings?.automation || { autoPost: true, requireApproval: true, rateLimitDelay: 30 }

        if (automation && automation.autoPost) {
          console.log('Auto-post is enabled, calling auto-post endpoint')
          try {
            const autoPostRes = await fetch(`${baseUrl}/api/tweets/auto-post`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || ''
              },
              body: JSON.stringify({ tweets: savedTweets, settings: automation })
            })

            try {
              autoPostResult = await autoPostRes.json()
            } catch (e) {
              autoPostResult = { error: 'Failed to parse auto-post response' }
            }

            if (!autoPostRes.ok) {
              console.error('Auto-post endpoint returned error', autoPostRes.status, autoPostResult)
            } else {
              console.log('Auto-post result:', autoPostResult)
            }
          } catch (autoErr) {
            console.error('Failed to call auto-post endpoint:', autoErr)
            autoPostResult = { error: autoErr instanceof Error ? autoErr.message : String(autoErr) }
          }
        } else {
          console.log('Auto-post is disabled by settings; skipping auto-post')
        }
      }
    } catch (err) {
      console.error('Error while attempting auto-post flow:', err)
    }

    return Response.json({
      success: true,
      articlesFound: articles.length,
      tweetsGenerated: tweets.length,
      tweetsSaved: saved,
      savedTweets,
      autoPostResult,
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