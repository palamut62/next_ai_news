import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { firebaseStorage } from "@/lib/firebase-storage"
import { getTwitterCharacterCount, validateTweetLength, truncateToCharacterLimit } from "@/lib/utils"
import { generateHashtags } from "@/lib/hashtag"
import { getApiKeyFromFirebaseOrEnv } from "@/lib/firebase-api-keys"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { repo } = await request.json()

    if (!repo || !repo.name || !repo.description || !repo.url) {
      return Response.json({ error: "Repository data is required" }, { status: 400 })
    }

    // Check if repository has already been processed (rejected or generated)
    const isRejected = await firebaseStorage.isGitHubRepoRejected(repo.fullName, repo.url)
    if (isRejected) {
      return Response.json({
        success: false,
        error: "Repository already processed",
        message: "This repository has already been used to generate tweets or was rejected."
      }, { status: 400 })
    }

    // Use Gemini AI to generate tweet from GitHub repository
    try {
      // Check if Google API key is available
      if (!process.env.GEMINI_API_KEY) {
        console.error(`⚠️ Google API key not found for GitHub repo: ${repo.name}`)
        return Response.json({
          success: false,
          error: "AI service unavailable",
          message: "The AI generation service is currently unavailable. Please try again later."
        }, { status: 503 })
      }

      // Calculate space reserved for URL and newlines
      const urlLength = getTwitterCharacterCount(repo.url)
      const reservedForUrl = urlLength + 2 // +2 for \n\n
      const maxTweetContent = 280 - reservedForUrl

      // Get Gemini API key from Firebase or fallback to env
      const geminiApiKey = await getApiKeyFromFirebaseOrEnv("gemini", "GEMINI_API_KEY")
      if (!geminiApiKey) {
        console.error(`⚠️ Gemini API key not found for GitHub repo: ${repo.name}`)
        return Response.json({
          success: false,
          error: "AI service unavailable",
          message: "The AI generation service is currently unavailable. Please configure your Gemini API key in Firebase or environment variables."
        }, { status: 503 })
      }

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create an engaging Twitter tweet about this GitHub repository. The tweet should be:
- Maximum ${maxTweetContent} characters (leaving room for the repository URL which is ${urlLength} characters)
- Be engaging and encourage interaction
- Include an emoji at the start
- Focus on what makes this repository interesting/valuable
- IMPORTANT: Do NOT include the repository URL or hashtags in your response - they will be added automatically

Repository Name: ${repo.name}
Repository Description: ${repo.description}
Language: ${repo.language}
Stars: ${repo.stars.toLocaleString()}
Forks: ${repo.forks.toLocaleString()}

Generate only the tweet text without URL or hashtags.`
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
          console.error(`❌ Google API error in GitHub: ${geminiResponse.status} ${geminiResponse.statusText}`)
          console.error(`Response text: ${responseText.slice(0, 500)}`)
          throw new Error('Google API error')
        }
        geminiData = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`❌ Failed to parse Google API response in GitHub:`, parseError)
        throw new Error('AI service unavailable')
      }

      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
        let generatedTweet = geminiData.candidates[0].content.parts[0].text.trim()

        // Validate and truncate tweet content if necessary
        const contentLength = getTwitterCharacterCount(generatedTweet)
        if (contentLength > maxTweetContent) {
          generatedTweet = truncateToCharacterLimit(generatedTweet, maxTweetContent)
        }

        // Generate hashtags that fit within the 280 limit
        const hashtags = generateHashtags(repo.name + " " + repo.description, 3)

        // Validate final tweet with URL and hashtags
        const validation = validateTweetLength(generatedTweet, repo.url, hashtags)

        // If over limit, reduce hashtags
        let finalHashtags = hashtags
        if (!validation.valid) {
          finalHashtags = hashtags.slice(0, 2)
          const validation2 = validateTweetLength(generatedTweet, repo.url, finalHashtags)
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

        // Bonus for mentioning specific repo features
        if (generatedTweet.toLowerCase().includes(repo.language.toLowerCase())) score += 0.5
        if (generatedTweet.includes(repo.stars.toString()) || generatedTweet.includes('star')) score += 0.3

        const aiScore = Math.max(1.0, Math.min(10, score))

        // Mark repository as processed to prevent duplicate generation
        try {
          await firebaseStorage.addRejectedGitHubRepo({
            fullName: repo.fullName,
            url: repo.url,
            name: repo.name,
            description: repo.description || "",
            language: repo.language || "",
            stars: repo.stars,
            reason: "tweet_generated"
          })
          console.log(`✅ Marked GitHub repository as processed: ${repo.fullName}`)
        } catch (markError) {
          console.error('Failed to mark repository as processed:', markError)
          // Don't fail the request if marking fails, just log it
        }

        return Response.json({
          success: true,
          tweet: generatedTweet,
          hashtags: finalHashtags,
          aiScore: parseFloat(aiScore.toFixed(1)),
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