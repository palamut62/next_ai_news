import { type NextRequest, NextResponse } from "next/server"
import { checkAuth, requireAuth } from "@/lib/auth"
import { postTweetToTwitter } from "@/lib/twitter-client"
import { supabaseStorage } from "@/lib/supabase-storage"
import type { Tweet } from "@/lib/types"

async function getTweets(): Promise<Tweet[]> {
  try {
    return await supabaseStorage.getAllTweets()
  } catch (error) {
    console.error("Failed to get tweets:", error)
    return []
  }
}

async function saveTweets(tweets: Tweet[]): Promise<void> {
  try {
    // Supabase storage manages its own state
    console.log(`Saving ${tweets.length} tweets to storage`)
  } catch (error) {
    console.error("Failed to save tweets:", error)
  }
}

export async function GET(request: NextRequest) {
  // Temporarily disable authentication for testing
  // if (!checkAuth(request)) {
  //   return requireAuth()
  // }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const source = searchParams.get("source")

    let tweets = await getTweets()

    // Filter by status if provided; otherwise hide posted tweets from main view
    if (status) {
      if (status === "all") {
        // Return all tweets regardless of status
        tweets = tweets
      } else {
        tweets = tweets.filter(tweet => tweet.status === status)
      }
    } else {
      tweets = tweets.filter(tweet => tweet.status !== 'posted')
    }

    // Filter by source if provided
    if (source) {
      tweets = tweets.filter(tweet => tweet.source === source)
    }

    return NextResponse.json(tweets)
  } catch (error) {
    console.error("Get tweets error:", error)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  // Temporarily disable authentication for testing
  // if (!checkAuth(request)) {
  //   return requireAuth()
  // }

  try {
    const body = await request.json()
    const { action, tweetId, tweetIds } = body

    let tweets = await getTweets()

    switch (action) {
      case "approve":
        // Update tweet status to approved and post to Twitter (single or bulk)
        if (tweetIds && Array.isArray(tweetIds)) {
          // Bulk approve
          for (const id of tweetIds) {
            const tweet = tweets.find(t => t.id === id)
            if (tweet) {
              // Mark the source (article or repo) as processed to prevent duplicate generation
              try {
                if (tweet.source === 'techcrunch') {
                  await supabaseStorage.addRejectedArticle({
                    title: tweet.sourceTitle,
                    url: tweet.sourceUrl,
                    source: "techcrunch",
                    publishedAt: tweet.createdAt,
                    description: tweet.content,
                    reason: "tweet_approved"
                  })
                  console.log(`✅ Marked TechCrunch article as processed: ${tweet.sourceTitle}`)
                } else if (tweet.source === 'github') {
                  await supabaseStorage.addRejectedGitHubRepo({
                    fullName: tweet.sourceTitle,
                    url: tweet.sourceUrl,
                    name: tweet.sourceTitle.split('/').pop() || tweet.sourceTitle,
                    description: tweet.content,
                    language: "",
                    stars: 0,
                    reason: "tweet_approved"
                  })
                  console.log(`✅ Marked GitHub repository as processed: ${tweet.sourceTitle}`)
                }
              } catch (markError) {
                console.error(`⚠️ Failed to mark source as processed for tweet ${id}:`, markError)
              }

              // Post to Twitter
              console.log(`🐦 Attempting to post tweet ${id}: "${tweet.content.substring(0, 50)}..."`)
              const twitterResult = await postTweetToTwitter(tweet.content, tweet.sourceUrl)
              console.log(`📊 Twitter API response for tweet ${id}:`, twitterResult)

              if (twitterResult.success) {
                console.log(`✅ Successfully posted tweet ${id} to Twitter, ID: ${twitterResult.tweetId}`)
                // Update tweet status to posted with Twitter ID
                const tweetIndex = tweets.findIndex(t => t.id === id)
                if (tweetIndex !== -1) {
                  tweets[tweetIndex] = {
                    ...tweets[tweetIndex],
                    status: "posted",
                    postedAt: new Date().toISOString(),
                    twitterId: twitterResult.tweetId
                  }
                }

                // Update status in Supabase database
                try {
                  await supabaseStorage.updateTweetStatus(id, "posted", {
                    posted_at: new Date().toISOString(),
                    twitter_id: twitterResult.tweetId
                  })
                  console.log(`✅ Updated tweet status in database: ${id}`)
                } catch (dbError) {
                  console.error(`❌ Failed to update tweet status in database: ${id}`, dbError)
                }
              } else {
                console.error(`❌ Failed to post tweet ${id}: ${twitterResult.error}`)
                // Mark as approved but not posted
                const tweetIndex = tweets.findIndex(t => t.id === id)
                if (tweetIndex !== -1) {
                  tweets[tweetIndex] = {
                    ...tweets[tweetIndex],
                    status: "approved",
                    postError: twitterResult.error
                  }
                }

                // Update status in Supabase database to approved
                try {
                  await supabaseStorage.updateTweetStatus(id, "approved", {
                    post_error: twitterResult.error
                  })
                  console.log(`✅ Updated tweet status in database to approved: ${id}`)
                } catch (dbError) {
                  console.error(`❌ Failed to update tweet status in database: ${id}`, dbError)
                }
              }
            }
          }
        } else if (tweetId) {
          // Single approve
          const tweet = tweets.find(t => t.id === tweetId)
          if (tweet) {
            // Mark the source (article or repo) as processed to prevent duplicate generation
            try {
              if (tweet.source === 'techcrunch') {
                await supabaseStorage.addRejectedArticle({
                  title: tweet.sourceTitle,
                  url: tweet.sourceUrl,
                  source: "techcrunch",
                  publishedAt: tweet.createdAt,
                  description: tweet.content,
                  reason: "tweet_approved"
                })
                console.log(`✅ Marked TechCrunch article as processed: ${tweet.sourceTitle}`)
              } else if (tweet.source === 'github') {
                await supabaseStorage.addRejectedGitHubRepo({
                  fullName: tweet.sourceTitle,
                  url: tweet.sourceUrl,
                  name: tweet.sourceTitle.split('/').pop() || tweet.sourceTitle,
                  description: tweet.content,
                  language: "",
                  stars: 0,
                  reason: "tweet_approved"
                })
                console.log(`✅ Marked GitHub repository as processed: ${tweet.sourceTitle}`)
              }
            } catch (markError) {
              console.error(`⚠️ Failed to mark source as processed for tweet ${tweetId}:`, markError)
            }

            // Post to Twitter
            const twitterResult = await postTweetToTwitter(tweet.content, tweet.sourceUrl)
            if (twitterResult.success) {
              // Update tweet status to posted with Twitter ID
              const tweetIndex = tweets.findIndex(t => t.id === tweetId)
              if (tweetIndex !== -1) {
                tweets[tweetIndex] = {
                  ...tweets[tweetIndex],
                  status: "posted",
                  postedAt: new Date().toISOString(),
                  twitterId: twitterResult.tweetId
                }
              }

              // Update status in Supabase database
              try {
                await supabaseStorage.updateTweetStatus(tweetId, "posted", {
                  posted_at: new Date().toISOString(),
                  twitter_id: twitterResult.tweetId
                })
                console.log(`✅ Updated tweet status in database: ${tweetId}`)
              } catch (dbError) {
                console.error(`❌ Failed to update tweet status in database: ${tweetId}`, dbError)
              }
            } else {
              console.error(`Failed to post tweet ${tweetId}: ${twitterResult.error}`)
              // Mark as approved but not posted
              const tweetIndex = tweets.findIndex(t => t.id === tweetId)
              if (tweetIndex !== -1) {
                tweets[tweetIndex] = {
                  ...tweets[tweetIndex],
                  status: "approved",
                  postError: twitterResult.error
                }
              }

              // Update status in Supabase database to approved
              try {
                await supabaseStorage.updateTweetStatus(tweetId, "approved", {
                  post_error: twitterResult.error
                })
                console.log(`✅ Updated tweet status in database to approved: ${tweetId}`)
              } catch (dbError) {
                console.error(`❌ Failed to update tweet status in database: ${tweetId}`, dbError)
              }
            }
          }
        }
        break
      case "reject":
        // Update tweet status to rejected and store source for duplicate checking
        if (tweetIds && Array.isArray(tweetIds)) {
          const tweetsToReject = tweets.filter(tweet => tweetIds.includes(tweet.id))

          // Store rejected tweets and mark sources as processed
          for (const tweet of tweetsToReject) {
            try {
              // Mark the source (article or repo) as processed to prevent duplicate generation
              if (tweet.source === 'techcrunch') {
                await supabaseStorage.addRejectedArticle({
                  title: tweet.sourceTitle,
                  url: tweet.sourceUrl,
                  source: "techcrunch",
                  publishedAt: tweet.createdAt,
                  description: tweet.content,
                  reason: "tweet_rejected"
                })
                console.log(`✅ Marked TechCrunch article as processed (rejected): ${tweet.sourceTitle}`)
              } else if (tweet.source === 'github') {
                await supabaseStorage.addRejectedGitHubRepo({
                  fullName: tweet.sourceTitle,
                  url: tweet.sourceUrl,
                  name: tweet.sourceTitle.split('/').pop() || tweet.sourceTitle,
                  description: tweet.content,
                  language: "",
                  stars: 0,
                  reason: "tweet_rejected"
                })
                console.log(`✅ Marked GitHub repository as processed (rejected): ${tweet.sourceTitle}`)
              }

              await supabaseStorage.updateTweetStatus(tweet.id, 'rejected')
            } catch (error) {
              console.error(`Failed to store rejected tweet ${tweet.id}:`, error)
            }
          }

          tweets = tweets.map(tweet =>
            tweetIds.includes(tweet.id) ? { ...tweet, status: "rejected", rejectedAt: new Date().toISOString() } : tweet
          )
        } else if (tweetId) {
          const tweetToReject = tweets.find(tweet => tweet.id === tweetId)
          if (tweetToReject) {
            try {
              // Mark the source (article or repo) as processed to prevent duplicate generation
              if (tweetToReject.source === 'techcrunch') {
                await supabaseStorage.addRejectedArticle({
                  title: tweetToReject.sourceTitle,
                  url: tweetToReject.sourceUrl,
                  source: "techcrunch",
                  publishedAt: tweetToReject.createdAt,
                  description: tweetToReject.content,
                  reason: "tweet_rejected"
                })
                console.log(`✅ Marked TechCrunch article as processed (rejected): ${tweetToReject.sourceTitle}`)
              } else if (tweetToReject.source === 'github') {
                await supabaseStorage.addRejectedGitHubRepo({
                  fullName: tweetToReject.sourceTitle,
                  url: tweetToReject.sourceUrl,
                  name: tweetToReject.sourceTitle.split('/').pop() || tweetToReject.sourceTitle,
                  description: tweetToReject.content,
                  language: "",
                  stars: 0,
                  reason: "tweet_rejected"
                })
                console.log(`✅ Marked GitHub repository as processed (rejected): ${tweetToReject.sourceTitle}`)
              }

              await supabaseStorage.updateTweetStatus(tweetId, 'rejected')
            } catch (error) {
              console.error(`Failed to store rejected tweet ${tweetId}:`, error)
            }
          }

          tweets = tweets.map(tweet =>
            tweet.id === tweetId ? { ...tweet, status: "rejected", rejectedAt: new Date().toISOString() } : tweet
          )
        }
        break
      case "delete":
        // Delete tweet permanently from storage
        if (tweetIds && Array.isArray(tweetIds)) {
          for (const id of tweetIds) {
            try {
              await supabaseStorage.deleteTweet(id)
            } catch (error) {
              console.error(`Failed to delete tweet ${id}:`, error)
            }
          }
          tweets = tweets.filter(tweet => !tweetIds.includes(tweet.id))
        } else if (tweetId) {
          try {
            await supabaseStorage.deleteTweet(tweetId)
          } catch (error) {
            console.error(`Failed to delete tweet ${tweetId}:`, error)
          }
          tweets = tweets.filter(tweet => tweet.id !== tweetId)
        }
        break
      case "post":
        // Mark tweet as posted (for bulk posting)
        if (tweetIds && Array.isArray(tweetIds)) {
          tweets = tweets.map(tweet =>
            tweetIds.includes(tweet.id) ? { ...tweet, status: "posted", postedAt: new Date().toISOString() } : tweet
          )
        } else if (tweetId) {
          tweets = tweets.map(tweet =>
            tweet.id === tweetId ? { ...tweet, status: "posted", postedAt: new Date().toISOString() } : tweet
          )
        }
        break
      case "save":
        // Save new tweet (for manual tweet creation)
        const { content, source = "manual", sourceUrl = "", sourceTitle = "", aiScore = 8.0, status = "pending" } = body
        const newTweet: Tweet = {
          id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          content,
          source,
          sourceUrl,
          sourceTitle,
          aiScore,
          status,
          createdAt: new Date().toISOString(),
          engagement: { likes: 0, retweets: 0, replies: 0 }
        }

        const saved = await supabaseStorage.saveTweet(newTweet)
        if (saved) {
          return NextResponse.json({ success: true, tweet: newTweet, message: "Tweet saved successfully" })
        } else {
          return NextResponse.json({ error: "Failed to save tweet - duplicate detected" }, { status: 400 })
        }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    await saveTweets(tweets)

    return NextResponse.json({
      success: true,
      message: `${action} completed successfully`,
      updatedTweets: tweets.filter(tweet => {
        if (action === "delete") return false // Don't return deleted tweets
        if (tweetIds && Array.isArray(tweetIds)) return tweetIds.includes(tweet.id)
        if (tweetId) return tweet.id === tweetId
        return true
      })
    })
  } catch (error) {
    console.error("POST tweets error:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
