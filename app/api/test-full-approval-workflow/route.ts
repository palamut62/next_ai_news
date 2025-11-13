import { NextRequest, NextResponse } from 'next/server'
import { firebaseStorage } from '@/lib/firebase-storage'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing FULL Approval Workflow...')

    // Get first pending tweet
    const tweets = await firebaseStorage.getTweets('pending')
    console.log(`Found ${tweets.length} pending tweets`)

    if (tweets.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No pending tweets found to test approval workflow"
      }, { status: 400 })
    }

    const testTweet = tweets[0]
    console.log(`\n📝 Testing with tweet: ${testTweet.id}`)
    console.log(`Content: "${testTweet.content.substring(0, 60)}..."`)
    console.log(`Original Status: ${testTweet.status}`)

    // Call the bulk-approve endpoint with autoPost=true
    console.log(`\n🚀 Calling /api/tweets/bulk-approve with autoPost=true...`)

    const approveResponse = await fetch(
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}/api/tweets/bulk-approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetIds: [testTweet.id],
          autoPost: true,  // Enable auto-posting
          tweets: [testTweet]
        })
      }
    )

    const approveResult = await approveResponse.json()
    console.log('\n📊 Approve Response:', approveResult)

    // Check if tweet status changed
    const updatedTweet = await firebaseStorage.getTweet(testTweet.id)
    console.log(`\n✅ Updated Tweet Status: ${updatedTweet?.status}`)

    if (updatedTweet?.twitter_id) {
      console.log(`🐦 Twitter ID: ${updatedTweet.twitter_id}`)
      console.log(`📱 Tweet URL: https://x.com/i/web/status/${updatedTweet.twitter_id}`)
    }

    return NextResponse.json({
      success: approveResponse.ok,
      message: "Full approval workflow test completed",
      testResult: {
        tweetId: testTweet.id,
        originalStatus: testTweet.status,
        newStatus: updatedTweet?.status,
        content: testTweet.content.substring(0, 80),
        approvalSucceeded: updatedTweet?.status === 'approved',
        postedToTwitter: updatedTweet?.status === 'posted',
        twitterId: updatedTweet?.twitter_id || null,
        twitterUrl: updatedTweet?.twitter_id ? `https://x.com/i/web/status/${updatedTweet.twitter_id}` : null
      },
      approveResult
    })
  } catch (error) {
    console.error('❌ Approval workflow error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
