import { type NextRequest, NextResponse } from "next/server"
import { checkAuth, requireAuth } from "@/lib/auth"
import { postTweetToTwitter } from "@/lib/twitter-client"
import { savePostedTweet } from "@/lib/tweet-storage"
import fs from "fs/promises"
import path from "path"
import type { Tweet } from "@/lib/types"

async function getTweets(): Promise<Tweet[]> {
  try {
    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    const tweetsData = await fs.readFile(tweetsFile, "utf-8")
    return JSON.parse(tweetsData)
  } catch (error) {
    // Return empty array if file doesn't exist or error occurs
    return []
  }
}

async function saveTweets(tweets: Tweet[]): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), "data")
    const tweetsFile = path.join(dataDir, "tweets.json")

    await fs.mkdir(dataDir, { recursive: true })
    await fs.writeFile(tweetsFile, JSON.stringify(tweets, null, 2))
  } catch (error) {
    console.error("Failed to save tweets:", error)
  }
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return requireAuth()
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const source = searchParams.get("source")

    let tweets = await getTweets()

    // Filter by status if provided; otherwise hide posted tweets from main view
    if (status) {
      tweets = tweets.filter(tweet => tweet.status === status)
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
  if (!checkAuth(request)) {
    return requireAuth()
  }

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
              // Post to Twitter
              console.log(`🐦 Attempting to post tweet ${id}: "${tweet.content.substring(0, 50)}..."`)
              const twitterResult = await postTweetToTwitter(tweet.content)
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
              }
            }
          }
        } else if (tweetId) {
          // Single approve
          const tweet = tweets.find(t => t.id === tweetId)
          if (tweet) {
            // Post to Twitter
            const twitterResult = await postTweetToTwitter(tweet.content)
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

              // Save posted tweet to storage and update stats
              try {
                const postedTweet: Tweet = {
                  id: twitterResult.tweetId || tweet.id,
                  content: tweet.content,
                  source: tweet.source,
                  sourceUrl: tweet.sourceUrl,
                  sourceTitle: tweet.sourceTitle,
                  aiScore: tweet.aiScore,
                  status: "posted",
                  createdAt: tweet.createdAt,
                  postedAt: new Date().toISOString(),
                  engagement: tweet.engagement || { likes: 0, retweets: 0, replies: 0 }
                }
                await savePostedTweet(postedTweet, {
                  title: tweet.sourceTitle,
                  description: tweet.content,
                  url: tweet.sourceUrl
                })
              } catch (saveErr) {
                console.error('Failed to save posted tweet (single approve):', saveErr)
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
            }
          }
        }
        break
      case "reject":
        // Update tweet status to rejected
        if (tweetIds && Array.isArray(tweetIds)) {
          tweets = tweets.map(tweet =>
            tweetIds.includes(tweet.id) ? { ...tweet, status: "rejected" } : tweet
          )
        } else if (tweetId) {
          tweets = tweets.map(tweet =>
            tweet.id === tweetId ? { ...tweet, status: "rejected" } : tweet
          )
        }
        break
      case "delete":
        // Delete tweet
        if (tweetIds && Array.isArray(tweetIds)) {
          tweets = tweets.filter(tweet => !tweetIds.includes(tweet.id))
        } else if (tweetId) {
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
        tweets.push(newTweet)
        await saveTweets(tweets)
        return NextResponse.json({ success: true, tweet: newTweet, message: "Tweet saved successfully" })
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
