import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { getApiKeyFromFirebaseOrEnv } from "@/lib/firebase-api-keys"

interface NewsArticle {
  title: string
  description: string
  url: string
  urlToImage: string | null
  publishedAt: string
  source: {
    name: string
  }
}

interface GeneratedTweet {
  id: string
  content: string
  source: string
  sourceUrl: string
  sourceTitle: string
  aiScore: number
  status: string
  createdAt: string
  publishedAt: string
  engagement: {
    likes: number
    retweets: number
    replies: number
  }
  newsData: {
    originalTitle: string
    publishedAt: string
    sourceName: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { articles } = await request.json() as { articles: NewsArticle[] }

    if (!articles || articles.length === 0) {
      return Response.json({ error: "No articles provided" }, { status: 400 })
    }

    const generatedTweets: GeneratedTweet[] = []

    for (const article of articles) {
      try {
        // Use Gemini AI to generate tweet from news article
        // Get Gemini API key from Firebase or fallback to env
        const geminiApiKey = await getApiKeyFromFirebaseOrEnv("gemini", "GEMINI_API_KEY")
        if (!geminiApiKey) {
          console.warn(`⚠️ Gemini API key not found, skipping article: ${article.title}`)
          continue
        }

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Create an engaging Twitter tweet about this AI news article. The tweet should be:
- Maximum 280 characters
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- Focus on the key insight or breakthrough
- Make it informative yet accessible

Article Title: ${article.title}
Article Description: ${article.description}
Source: ${article.source.name}

Generate only the tweet text, nothing else.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 100,
            }
          })
        })

        // Safe response handling
        let geminiData
        try {
          const responseText = await geminiResponse.text()
          if (!geminiResponse.ok) {
            console.error(`❌ Google API error: ${geminiResponse.status} ${geminiResponse.statusText}`)
            console.error(`Response text: ${responseText.slice(0, 500)}`)
            continue
          }
          geminiData = JSON.parse(responseText)
        } catch (parseError) {
          console.error(`❌ Failed to parse Google API response:`, parseError)
          continue
        }

        let tweetContent = ""

        if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
          tweetContent = geminiData.candidates[0].content.parts[0].text.trim()
        } else {
          // If Gemini AI fails, skip this article instead of using fallback content
          console.warn(`⚠️ Failed to generate tweet for article: ${article.title}`)
          continue
        }

        // Calculate AI score
        let score = 7.0
        if (tweetContent.includes('#')) score += 0.5
        if (tweetContent.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5
        if (tweetContent.length > 100 && tweetContent.length < 250) score += 1.0
        if (tweetContent.includes('?') || tweetContent.includes('!')) score += 0.5
        if (article.source.name.includes('OpenAI') || article.source.name.includes('Google') || article.source.name.includes('Meta')) score += 0.5

        const aiScore = Math.min(10, score)

        const generatedTweet: GeneratedTweet = {
          id: Math.random().toString(36).substring(2, 15),
          content: tweetContent,
          source: "ai_news",
          sourceUrl: article.url,
          sourceTitle: article.title,
          aiScore: parseFloat(aiScore.toFixed(1)),
          status: "pending",
          createdAt: new Date().toISOString(),
          publishedAt: article.publishedAt,
          engagement: {
            likes: 0,
            retweets: 0,
            replies: 0
          },
          newsData: {
            originalTitle: article.title,
            publishedAt: article.publishedAt,
            sourceName: article.source.name
          }
        }

        generatedTweets.push(generatedTweet)

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (articleError) {
        console.error(`Failed to generate tweet for article: ${article.title}`, articleError)
        continue
      }
    }

    return Response.json({
      success: true,
      tweets: generatedTweets,
      generated: generatedTweets.length,
      total: articles.length,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Generate tweets from news error:", error)
    return Response.json({ error: "Failed to generate tweets from news" }, { status: 500 })
  }
}