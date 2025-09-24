import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { repo } = await request.json()

    if (!repo || !repo.name || !repo.description || !repo.url) {
      return Response.json({ error: "Repository data is required" }, { status: 400 })
    }

    // Use Gemini AI to generate tweet from GitHub repository
    try {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet about this GitHub repository. The tweet should be:
- Maximum 240 characters (leaving room for the repository URL)
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- Focus on what makes this repository interesting/valuable
- IMPORTANT: Do NOT include the repository URL in your response - it will be added automatically

Repository Name: ${repo.name}
Repository Description: ${repo.description}
Language: ${repo.language}
Stars: ${repo.stars.toLocaleString()}
Forks: ${repo.forks.toLocaleString()}

Repository URL that will be added: ${repo.url}

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

        // Add repository URL to the tweet
        const finalTweet = `${generatedTweet}\n\n${repo.url}`

        // Calculate AI score based on length, hashtags, emojis
        let score = 7.0
        if (finalTweet.includes('#')) score += 0.5
        if (finalTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5

        // Score based on final length (including URL)
        const finalLength = finalTweet.length
        if (finalLength > 150 && finalLength <= 280) score += 1.0
        if (finalLength <= 280) score += 0.5 // Bonus for fitting within limit

        if (finalTweet.includes('?') || finalTweet.includes('!')) score += 0.5

        // Bonus for mentioning specific repo features
        if (generatedTweet.toLowerCase().includes(repo.language.toLowerCase())) score += 0.5
        if (generatedTweet.includes(repo.stars.toString()) || generatedTweet.includes('star')) score += 0.3

        const aiScore = Math.min(10, score)

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
          error: "AI generation failed. Please try again with a different repository.",
          message: "The AI service couldn't generate a tweet from the provided repository."
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
    console.error("Generate from GitHub repo error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}