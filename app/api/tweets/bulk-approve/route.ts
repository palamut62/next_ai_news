import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { postTextTweetV2 } from "@/lib/twitter-v2-client"
import { savePostedTweet } from "@/lib/tweet-storage"
import fs from 'fs/promises'
import path from 'path'


export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

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

        // If autoPost is true, post to Twitter immediately
        if (autoPost) {
          console.log(`Auto-posting tweet ${tweetId} to Twitter...`)
          const twitterResult = await postTextTweetV2(tweetData.content, tweetData.sourceUrl)

          if (twitterResult.success) {
            postedCount++

            // Save posted tweet to storage
            const postedTweet = {
              id: twitterResult.tweet_id || tweetId,
              content: tweetData.content,
              source: tweetData.source,
              sourceUrl: tweetData.sourceUrl,
              sourceTitle: tweetData.sourceTitle,
              aiScore: tweetData.aiScore,
              status: "posted" as const,
              createdAt: tweetData.createdAt,
              postedAt: new Date().toISOString(),
              engagement: {
                likes: 0,
                retweets: 0,
                replies: 0
              }
            }

            try {
              await savePostedTweet(postedTweet, {
                title: tweetData.sourceTitle,
                description: tweetData.content,
                url: tweetData.sourceUrl
              })
            } catch (storageError) {
              console.error(`⚠️ Failed to save posted tweet ${tweetId} to storage:`, storageError)
            }

            // Persist change to main tweets.json
            try {
              const dataDir = path.join(process.cwd(), 'data')
              const tweetsFile = path.join(dataDir, 'tweets.json')
              await fs.mkdir(dataDir, { recursive: true })
              let existingTweets = []
              try {
                const txt = await fs.readFile(tweetsFile, 'utf-8')
                existingTweets = JSON.parse(txt)
              } catch (e) {
                existingTweets = []
              }

              const idx = existingTweets.findIndex((t: any) => t.id === tweetId)
              if (idx !== -1) {
                existingTweets[idx] = {
                  ...existingTweets[idx],
                  status: 'posted',
                  postedAt: new Date().toISOString(),
                  twitterId: twitterResult.tweet_id
                }
              }

              await fs.writeFile(tweetsFile, JSON.stringify(existingTweets, null, 2))
            } catch (persistError) {
              console.error(`⚠️ Failed to persist tweet status for ${tweetId}:`, persistError)
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

            // Persist approved status and postError to main tweets.json
            try {
              const dataDir = path.join(process.cwd(), 'data')
              const tweetsFile = path.join(dataDir, 'tweets.json')
              await fs.mkdir(dataDir, { recursive: true })
              let existingTweets = []
              try {
                const txt = await fs.readFile(tweetsFile, 'utf-8')
                existingTweets = JSON.parse(txt)
              } catch (e) {
                existingTweets = []
              }

              const idx = existingTweets.findIndex((t: any) => t.id === tweetId)
              if (idx !== -1) {
                existingTweets[idx] = {
                  ...existingTweets[idx],
                  status: 'approved',
                  postError: twitterResult.error || null
                }
              }

              await fs.writeFile(tweetsFile, JSON.stringify(existingTweets, null, 2))
            } catch (persistError) {
              console.error(`⚠️ Failed to persist approved status for ${tweetId}:`, persistError)
            }
          }

          // Add delay to respect Twitter API rate limits (300 requests per 3 hours = ~1 every 36 seconds)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
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