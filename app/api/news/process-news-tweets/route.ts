import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { logAPIEvent } from "@/lib/audit-logger"

async function getApiUrlFromSettings(): Promise<string | null> {
  try {
    // Use the current request URL to determine the base URL
    const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'http://77.37.54.38:3001')

    const settingsResponse = await fetch(`${baseUrl}/api/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (settingsResponse.ok) {
      const settingsText = await settingsResponse.text()
      let settings
      try {
        settings = JSON.parse(settingsText)
      } catch (parseError) {
        console.error('Failed to parse settings JSON:', parseError)
        console.error('Settings response text:', settingsText.slice(0, 200))
        return null
      }
      return settings.apiUrl || null
    }
  } catch (error) {
    console.error('Failed to fetch settings for API URL:', error)
  }
  return null
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

    // Step 1: Fetch AI news articles
  const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ((await getApiUrlFromSettings()) || process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-news-tweet-app.vercel.app')
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

    // Safe JSON parse for fetch response
    const fetchResponseText = await fetchResponse.text()
    let fetchResponseData
    try {
      fetchResponseData = JSON.parse(fetchResponseText)
    } catch (parseError) {
      console.error('Failed to parse fetch response JSON:', parseError)
      console.error('Fetch response text:', fetchResponseText.slice(0, 500))
      throw new Error('Invalid JSON response from fetch-ai-news API')
    }

    const { articles, isRealData } = fetchResponseData

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

    // Safe JSON parse for save response
    const saveResponseText = await saveResponse.text()
    let saveResponseData
    try {
      saveResponseData = JSON.parse(saveResponseText)
    } catch (parseError) {
      console.error('Failed to parse save response JSON:', parseError)
      console.error('Save response text:', saveResponseText.slice(0, 500))
      throw new Error('Invalid JSON response from save-tweets API')
    }

    const { saved, savedTweets } = saveResponseData

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
          const settingsText = await settingsRes.text()
          try {
            settings = JSON.parse(settingsText)
          } catch (parseError) {
            console.error('Failed to parse settings JSON in auto-post:', parseError)
            console.error('Auto-post settings response text:', settingsText.slice(0, 200))
          }
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
              const autoPostText = await autoPostRes.text()
              try {
                autoPostResult = JSON.parse(autoPostText)
              } catch (parseError) {
                console.error('Failed to parse auto-post response JSON:', parseError)
                console.error('Auto-post response text:', autoPostText.slice(0, 500))
                autoPostResult = { error: 'Failed to parse auto-post response JSON' }
              }
            } catch (e) {
              autoPostResult = { error: 'Failed to read auto-post response' }
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