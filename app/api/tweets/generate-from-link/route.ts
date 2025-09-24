import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

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
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet based on this article content. The tweet should be:
- Maximum ${Math.max(200, 280 - url.length - 3)} characters (leaving room for the source URL and newlines)
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- IMPORTANT: Do NOT include the source URL in your response - it will be added automatically

Article Title: ${articleTitle}
Article Content: ${articleContent}

Source URL that will be added (${url.length} characters): ${url}

IMPORTANT: Keep your response under ${Math.max(200, 280 - url.length - 3)} characters to ensure the final tweet with URL stays under 280 characters.

Generate only the tweet text, nothing else.`
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

        // Calculate maximum allowed length for the tweet content
        const maxTweetContentLength = Math.max(200, 280 - url.length - 3) // -3 for \n\n

        // Truncate if necessary
        if (generatedTweet.length > maxTweetContentLength) {
          generatedTweet = generatedTweet.substring(0, maxTweetContentLength - 3) + "..."
        }

        // Add source URL to the tweet
        const sourceUrl = url
        const finalTweet = `${generatedTweet}\n\n${sourceUrl}`

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

        const aiScore = Math.max(1.0, Math.min(10, score))

        return Response.json({
          success: true,
          tweet: finalTweet,
          aiScore: parseFloat(aiScore.toFixed(1)),
          sourceUrl: url,
          sourceTitle: articleTitle,
          tweetLength: finalLength,
          originalTweetLength: generatedTweet.length
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