import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { postTextTweetV2 } from "@/lib/twitter-v2-client"
import { supabaseStorage } from "@/lib/supabase-storage"


export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { tweetIds, autoPost, tweets } = await request.json()

    if (!tweetIds || !Array.isArray(tweetIds)) {
      return Response.json({ error: "Tweet IDs are required" }, { status: 400 })
    }

    // Process each tweet - approve and optionally post to Twitter
    const results = []
    let approvedCount = 0
    let postedCount = 0
    let failedCount = 0

    for (const tweetId of tweetIds) {
      try {
        // Find the tweet data from the provided tweets array
        const tweetData = tweets?.find((t: any) => t.id === tweetId)

        if (!tweetData) {
          failedCount++
          results.push({
            tweetId,
            approved: false,
            posted: false,
            error: "Tweet data not found",
            message: "Tweet data not provided"
          })
          console.error(`❌ Tweet data not found for ID: ${tweetId}`)
          continue
        }

        console.log(`Processing tweet ${tweetId}: ${tweetData.content.substring(0, 50)}...`)

        // Always approve the tweet first
        approvedCount++

        // Mark the source (article or repo) as processed to prevent duplicate generation
        try {
          if (tweetData.source === 'techcrunch') {
            await supabaseStorage.addRejectedArticle({
              title: tweetData.sourceTitle,
              url: tweetData.sourceUrl,
              source: "techcrunch",
              publishedAt: tweetData.createdAt,
              description: tweetData.content,
              reason: "tweet_approved"
            })
            console.log(`✅ Marked TechCrunch article as processed: ${tweetData.sourceTitle}`)
          } else if (tweetData.source === 'github') {
            await supabaseStorage.addRejectedGitHubRepo({
              fullName: tweetData.sourceTitle,
              url: tweetData.sourceUrl,
              name: tweetData.sourceTitle.split('/').pop() || tweetData.sourceTitle,
              description: tweetData.content,
              language: "",
              stars: 0,
              reason: "tweet_approved"
            })
            console.log(`✅ Marked GitHub repository as processed: ${tweetData.sourceTitle}`)
          }
        } catch (markError) {
          console.error(`⚠️ Failed to mark source as processed for tweet ${tweetId}:`, markError)
          // Don't fail the request if marking fails, just log it
        }

        // If autoPost is true, post to Twitter immediately
        if (autoPost) {
          console.log(`Auto-posting tweet ${tweetId} to Twitter...`)
          const twitterResult = await postTextTweetV2(tweetData.content, tweetData.sourceUrl)

          if (twitterResult.success) {
            postedCount++

            // Update tweet status in Supabase
            try {
              await supabaseStorage.updateTweetStatus(tweetId, 'posted', {
                twitter_id: twitterResult.tweet_id,
                posted_at: new Date().toISOString()
              })
            } catch (updateError) {
              console.error(`⚠️ Failed to update tweet status in Supabase for ${tweetId}:`, updateError)
            }

            results.push({
              tweetId,
              approved: true,
              posted: true,
              twitterId: twitterResult.tweet_id,
              postedAt: new Date().toISOString(),
              message: "Tweet approved and posted successfully to Twitter! 🎉"
            })

            console.log(`✅ Tweet ${tweetId} approved and posted to Twitter (ID: ${twitterResult.tweet_id})`)
          } else {
            failedCount++
            results.push({
              tweetId,
              approved: true,
              posted: false,
              error: twitterResult.error,
              details: twitterResult.details || null,
              message: "Tweet approved but failed to post to Twitter"
            })

            console.error(`❌ Tweet ${tweetId} approved but failed to post: ${twitterResult.error}`, twitterResult.details || '')

            // Update tweet status in Supabase
            try {
              await supabaseStorage.updateTweetStatus(tweetId, 'approved')
            } catch (updateError) {
              console.error(`⚠️ Failed to update tweet status in Supabase for ${tweetId}:`, updateError)
            }
          }

          // Add delay to respect Twitter API rate limits (300 requests per 3 hours = ~1 every 36 seconds)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Update tweet status to approved in Supabase
          try {
            await supabaseStorage.updateTweetStatus(tweetId, 'approved')
          } catch (updateError) {
            console.error(`⚠️ Failed to update tweet status in Supabase for ${tweetId}:`, updateError)
          }

          results.push({
            tweetId,
            approved: true,
            posted: false,
            message: "Tweet approved successfully (auto-post disabled)"
          })

          console.log(`✅ Tweet ${tweetId} approved (not posted - autoPost disabled)`)
        }

      } catch (error) {
        failedCount++
        results.push({
          tweetId,
          approved: false,
          posted: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: "Failed to process tweet"
        })

        console.error(`❌ Error processing tweet ${tweetId}:`, error)
      }
    }

    const message = autoPost
      ? `${approvedCount} tweets processed: ${postedCount} posted successfully, ${failedCount} failed`
      : `${approvedCount} tweets approved successfully`

    console.log(`📊 Bulk approval complete: ${message}`)

    return Response.json({
      success: true,
      message,
      autoPost,
      results,
      summary: {
        total: tweetIds.length,
        approved: approvedCount,
        posted: postedCount,
        failed: failedCount
      }
    })
  } catch (error) {
    console.error("Bulk approve error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}