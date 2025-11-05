import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { getTwitterCharacterCount, validateTweetLength, truncateToCharacterLimit } from "@/lib/utils"
import { generateHashtags } from "@/lib/hashtag"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Fetch article content
    let articleContent = ""
    let articleTitle = ""

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Tweet-Bot/1.0)'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const html = await response.text()

      // Basic content extraction (in production, use a proper HTML parser)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      articleTitle = titleMatch ? titleMatch[1].trim() : "Article"

      // Extract text content (simplified)
      const textContent = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000) // Limit content for AI processing

      articleContent = textContent
    } catch (error) {
      console.error("Failed to fetch article:", error)
      articleContent = `Article from ${url}`
      articleTitle = "Web Article"
    }

    // Use Gemini AI to generate tweet
    try {
      // Calculate space reserved for URL and newlines
      const urlLength = getTwitterCharacterCount(url)
      const reservedForUrl = urlLength + 2 // +2 for \n\n
      const maxTweetContent = 280 - reservedForUrl

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet based on this article content. The tweet should be:
- Maximum ${maxTweetContent} characters (leaving room for the source URL which is ${urlLength} characters)
- Be engaging and encourage interaction
- Include an emoji at the start
- IMPORTANT: Do NOT include the source URL or hashtags in your response - they will be added automatically

Article Title: ${articleTitle}
Article Content: ${articleContent}

Generate only the tweet text without URL or hashtags.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100,
          }
        })
      })

      const geminiData = await geminiResponse.json()

      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
        let generatedTweet = geminiData.candidates[0].content.parts[0].text.trim()

        // Validate and truncate tweet content if necessary
        const contentLength = getTwitterCharacterCount(generatedTweet)
        if (contentLength > maxTweetContent) {
          generatedTweet = truncateToCharacterLimit(generatedTweet, maxTweetContent)
        }

        // Generate hashtags that fit within the 280 limit
        const hashtags = generateHashtags(articleTitle + " " + articleContent, 3)

        // Validate final tweet with URL and hashtags
        const validation = validateTweetLength(generatedTweet, url, hashtags)

        // If over limit, reduce hashtags
        let finalHashtags = hashtags
        if (!validation.valid) {
          finalHashtags = hashtags.slice(0, 2)
          const validation2 = validateTweetLength(generatedTweet, url, finalHashtags)
          if (!validation2.valid) {
            finalHashtags = hashtags.slice(0, 1)
          }
        }

        // Calculate AI score based on validation
        let score = 7.0
        if (finalHashtags.length > 0) score += 0.5
        if (generatedTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5

        // Score based on final validation
        if (validation.valid) {
          score += 1.5 // Major bonus for fitting within limit
          if (validation.remaining > 20) score += 0.5 // Bonus for efficient use of space
        } else {
          score -= 2.0 // Penalty for exceeding limit
        }

        if (generatedTweet.includes('?') || generatedTweet.includes('!')) score += 0.5

        const aiScore = Math.max(1.0, Math.min(10, score))

        return Response.json({
          success: true,
          tweet: generatedTweet,
          hashtags: finalHashtags,
          aiScore: parseFloat(aiScore.toFixed(1)),
          sourceUrl: url,
          sourceTitle: articleTitle,
          tweetLength: contentLength,
          finalLength: validation.length,
          validation: {
            valid: validation.valid,
            remaining: validation.remaining
          }
        })
      } else {
        console.error("Failed to generate tweet with AI - no candidates returned")
        return Response.json({
          success: false,
          error: "AI generation failed. Please try again with a different URL.",
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
    console.error("Generate from link error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}