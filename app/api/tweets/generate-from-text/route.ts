import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { text } = await request.json()

    if (!text || text.trim().length === 0) {
      return Response.json({ error: "Text is required" }, { status: 400 })
    }

    if (text.length > 5000) {
      return Response.json({ error: "Text is too long (max 5000 characters)" }, { status: 400 })
    }

    // Use Gemini AI to generate tweet from text
    try {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet based on this text/idea. The tweet should be:
- Maximum 280 characters
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- Transform the text into a conversational, tweet-style format

Input Text: ${text}

Generate only the tweet text, nothing else.`
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 100,
          }
        })
      })

      const geminiData = await geminiResponse.json()

      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
        const generatedTweet = geminiData.candidates[0].content.parts[0].text.trim()

        // Calculate AI score
        let score = 7.5
        if (generatedTweet.includes('#')) score += 0.5
        if (generatedTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5
        if (generatedTweet.length > 100 && generatedTweet.length < 250) score += 1.0
        if (generatedTweet.includes('?') || generatedTweet.includes('!')) score += 0.5

        const aiScore = Math.min(10, score)

        return Response.json({
          success: true,
          tweet: generatedTweet,
          aiScore: parseFloat(aiScore.toFixed(1)),
          sourceText: text.substring(0, 100) + (text.length > 100 ? "..." : "")
        })
      } else {
        console.error("Failed to generate tweet with AI - no candidates returned")
        return Response.json({
          success: false,
          error: "AI generation failed. Please try again with different text.",
          message: "The AI service couldn't generate a tweet from the provided text."
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
    console.error("Generate from text error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}