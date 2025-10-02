import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import type { TechCrunchArticle } from "@/lib/types"
import { supabaseStorage } from "@/lib/supabase-storage"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { article } = await request.json()

    if (!article || !article.title || !article.description || !article.url) {
      return Response.json({ error: "Article data is required" }, { status: 400 })
    }

    // Check if article has already been processed (rejected or generated)
    const isRejected = await supabaseStorage.isArticleRejected(article.title, article.url)
    if (isRejected) {
      return Response.json({
        success: false,
        error: "Article already processed",
        message: "This article has already been used to generate tweets or was rejected."
      }, { status: 400 })
    }

    // Use Gemini AI to generate tweet from TechCrunch article
    try {
      // Check if Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.error(`⚠️ Google API key not found for TechCrunch article: ${article.title}`)
        return Response.json({
          success: false,
          error: "AI service unavailable",
          message: "The AI generation service is currently unavailable. Please try again later."
        }, { status: 503 })
      }

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet based on this TechCrunch article. The tweet should be:
- Maximum ${Math.max(200, 280 - article.url.length - 3)} characters (leaving room for the article URL and newlines)
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- Focus on the main news/trend from the article
- IMPORTANT: Do NOT include the article URL in your response - it will be added automatically

Article Title: ${article.title}
Article Description: ${article.description}
Article Content: ${article.content}
Author: ${article.author}
Categories: ${article.categories.join(', ')}

Article URL that will be added (${article.url.length} characters): ${article.url}

IMPORTANT: Keep your response under ${Math.max(200, 280 - article.url.length - 3)} characters to ensure the final tweet with URL stays under 280 characters.

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
          console.error(`❌ Google API error in TechCrunch: ${geminiResponse.status} ${geminiResponse.statusText}`)
          console.error(`Response text: ${responseText.slice(0, 500)}`)
          throw new Error('Google API error')
        }
        geminiData = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`❌ Failed to parse Google API response in TechCrunch:`, parseError)
        throw new Error('AI service unavailable')
      }

      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
        let generatedTweet = geminiData.candidates[0].content.parts[0].text.trim()

        // Calculate maximum allowed length for the tweet content
        const maxTweetContentLength = Math.max(200, 280 - article.url.length - 3) // -3 for \n\n

        // Truncate if necessary
        if (generatedTweet.length > maxTweetContentLength) {
          generatedTweet = generatedTweet.substring(0, maxTweetContentLength - 3) + "..."
        }

        // Add article URL to the tweet
        const finalTweet = `${generatedTweet}\n\n${article.url}`

        // Calculate AI score based on length, hashtags, emojis
        let score = 7.0
        if (finalTweet.includes('#')) score += 0.5
        if (finalTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5

        // Score based on final length (including URL)
        const finalLength = finalTweet.length
        if (finalLength <= 280) {
          score += 1.5 // Major bonus for fitting within limit
          if (finalLength > 250) score += 0.5 // Bonus for efficient use of space
        } else {
          score -= 2.0 // Penalty for exceeding limit
        }

        if (finalTweet.includes('?') || finalTweet.includes('!')) score += 0.5

        // Bonus for mentioning tech news elements
        if (generatedTweet.toLowerCase().includes('tech') || generatedTweet.toLowerCase().includes('startup')) score += 0.3
        if (generatedTweet.toLowerCase().includes(article.author.toLowerCase())) score += 0.3

        const aiScore = Math.max(1.0, Math.min(10, score))

        // Mark article as processed to prevent duplicate generation
        try {
          await supabaseStorage.addRejectedArticle({
            title: article.title,
            url: article.url,
            source: "techcrunch",
            publishedAt: article.publishedAt,
            description: article.description,
            reason: "tweet_generated"
          })
          console.log(`✅ Marked TechCrunch article as processed: ${article.title}`)
        } catch (markError) {
          console.error('Failed to mark article as processed:', markError)
          // Don't fail the request if marking fails, just log it
        }

        return Response.json({
          success: true,
          tweet: finalTweet,
          aiScore: parseFloat(aiScore.toFixed(1)),
          tweetLength: finalLength,
          originalTweetLength: generatedTweet.length
        })
      } else {
        console.error("Failed to generate tweet with AI - no candidates returned")
        return Response.json({
          success: false,
          error: "AI generation failed. Please try again with a different article.",
          message: "The AI service couldn't generate a tweet from the provided article."
        }, { status: 500 })
      }
    } catch (aiError) {
      console.error("AI generation failed:", aiError)
      return Response.json({
        success: false,
        error: "AI service unavailable",
        message: "The AI generation service is currently unavailable. Please try again later."
      }, { status: 503 })
    }

  } catch (error) {
    console.error("Generate from TechCrunch article error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}