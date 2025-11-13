import { NextRequest, NextResponse } from 'next/server'
import { firebaseStorage } from '@/lib/firebase-storage'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing approval workflow...')

    // Get first pending tweet
    const tweets = await firebaseStorage.getTweets('pending')
    console.log(`Found ${tweets.length} pending tweets`)

    if (tweets.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No pending tweets found. Create some first."
      }, { status: 400 })
    }

    const testTweet = tweets[0]
    console.log(`Testing approval on tweet: ${testTweet.id}`)
    console.log(`Tweet content: "${testTweet.content.substring(0, 50)}..."`)

    // Call the bulk-approve endpoint
    const approveResponse = await fetch(
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}/api/tweets/bulk-approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetIds: [testTweet.id],
          autoPost: false, // Don't auto-post (keys invalid anyway)
          tweets: [testTweet]
        })
      }
    )

    const approveResult = await approveResponse.json()
    console.log('Approve result:', approveResult)

    // Check if tweet status changed
    const updatedTweet = await firebaseStorage.getTweet(testTweet.id)
    console.log(`Tweet status after approve: ${updatedTweet?.status}`)

    return NextResponse.json({
      success: approveResponse.ok,
      message: "Approval workflow test completed",
      originalStatus: testTweet.status,
      newStatus: updatedTweet?.status,
      tweetId: testTweet.id,
      tweetContent: testTweet.content.substring(0, 80),
      approveResult: approveResult,
      workflowResult: {
        approved: updatedTweet?.status === 'approved',
        statusChanged: testTweet.status !== updatedTweet?.status
      }
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
