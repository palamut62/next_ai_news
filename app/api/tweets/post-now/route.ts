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

  const { content, source, sourceUrl, sourceTitle, aiScore } = await request.json()
  let updatedPending = false

    if (!content || content.trim().length === 0) {
      return Response.json({ error: "Tweet content is required" }, { status: 400 })
    }

    if (content.length > 280) {
      return Response.json({ error: "Tweet too long (max 280 characters)" }, { status: 400 })
    }

    // Twitter v2 API ile tweet at
  const twitterResult = await postTextTweetV2(content, sourceUrl)

    if (!twitterResult.success) {
      return Response.json({
        error: `Failed to post tweet: ${twitterResult.error}`,
        details: twitterResult.details || null
      }, { status: 500 })
    }

    const postedTweet = {
      id: twitterResult.tweet_id || Date.now().toString(),
      content,
      source: source || "manual",
      sourceUrl: sourceUrl || "",
      sourceTitle: sourceTitle || "Manual Creation",
      aiScore: aiScore || 8.0,
      status: "posted",
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      engagement: {
        likes: 0,
        retweets: 0,
        replies: 0
      }
    }

    try {
      // Save into posted-tweets for statistics
      await savePostedTweet(postedTweet as any, {
        title: sourceTitle || 'Manual Creation',
        description: content,
        url: sourceUrl || ''
      })
    } catch (e) {
      console.error('Failed to save posted tweet to posted-tweets:', e)
    }

    // Also update main tweets.json: mark matching pending tweet as posted or append if not present
    try {
      const dataDir = path.join(process.cwd(), 'data')
      const tweetsFile = path.join(dataDir, 'tweets.json')
      await fs.mkdir(dataDir, { recursive: true })
      let existingTweets: any[] = []
      try {
        const txt = await fs.readFile(tweetsFile, 'utf-8')
        existingTweets = JSON.parse(txt)
      } catch (e) {
        existingTweets = []
      }

      // Robust matching heuristics to find the saved pending tweet:
      // 1) exact content
      // 2) exact sourceUrl
      // 3) normalized content equality (strip urls/hashtags and whitespace)
      // 4) normalized substring match
      // 5) sourceTitle match
      const normalize = (s: string) => (s || '').replace(/https?:\/\/\S+/g, '').replace(/#\w+/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

      let idx = existingTweets.findIndex(t => t.content === content || (sourceUrl && t.sourceUrl === sourceUrl))

      if (idx === -1) {
        const normNew = normalize(content)
        idx = existingTweets.findIndex(t => {
          const normExisting = normalize(t.content || '')
          if (!normExisting) return false
          if (normExisting === normNew) return true
          if (normExisting.includes(normNew) || normNew.includes(normExisting)) return true
          if (sourceTitle && (String(t.sourceTitle || '').trim().toLowerCase() === String(sourceTitle || '').trim().toLowerCase())) return true
          return false
        })
      }

      let updatedPending = false
      if (idx !== -1) {
        console.log(`Found matching saved tweet at index ${idx}, marking as posted`)
        existingTweets[idx] = {
          ...existingTweets[idx],
          status: 'posted',
          postedAt: new Date().toISOString(),
          twitterId: twitterResult.tweet_id
        }
        updatedPending = true
      } else {
        console.log('No matching saved tweet found, appending posted tweet to tweets.json')
        existingTweets.push(postedTweet)
      }

      await fs.writeFile(tweetsFile, JSON.stringify(existingTweets, null, 2))
    } catch (e) {
      console.error('Failed to update main tweets.json after manual post:', e)
    }

    return Response.json({
      success: true,
      message: "Tweet posted successfully!",
      tweet: postedTweet,
      twitterUrl: twitterResult.url,
      updatedPending: typeof updatedPending !== 'undefined' ? updatedPending : false
    })

  } catch (error) {
    console.error("Post tweet error:", error)
    return Response.json({ error: "Failed to post tweet" }, { status: 500 })
  }
}