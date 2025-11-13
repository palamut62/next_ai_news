import { NextRequest, NextResponse } from 'next/server'
import { postTextTweetV2 } from '@/lib/twitter-v2-client'

export async function POST(request: NextRequest) {
  try {
    const testTweetText = "🧪 Test tweet from AI News Bot - Tweet API is working! #test #ai"
    const testUrl = "https://github.com/test"

    console.log("🚀 Testing tweet posting directly...")
    console.log(`Tweet text: "${testTweetText}"`)

    const result = await postTextTweetV2(testTweetText, testUrl, [])

    console.log("📊 Tweet posting result:", result)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "✅ Tweet posted successfully!",
        tweetId: result.tweet_id,
        url: result.url,
        tweetLength: result.finalLength
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }
  } catch (error) {
    console.error("❌ Test endpoint error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // For testing via browser
  return POST(request)
}
