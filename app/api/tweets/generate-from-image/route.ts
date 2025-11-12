import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { getApiKeyFromFirebaseOrEnv } from "@/lib/firebase-api-keys"

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const formData = await request.formData()
    const image = formData.get("image") as File

    if (!image) {
      return Response.json({ error: "Image is required" }, { status: 400 })
    }

    // Validate file type
    if (!image.type.startsWith("image/")) {
      return Response.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (image.size > 10 * 1024 * 1024) {
      return Response.json({ error: "Image too large (max 10MB)" }, { status: 400 })
    }

    // Convert image to base64 for Gemini Vision
    const imageBuffer = await image.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // Use Gemini Vision AI to analyze image and generate tweet
    try {
      // Get Gemini API key from Firebase or fallback to env
      const geminiApiKey = await getApiKeyFromFirebaseOrEnv("gemini", "GEMINI_API_KEY")
      if (!geminiApiKey) {
        console.error(`⚠️ Gemini API key not found`)
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
            parts: [
              {
                text: `Analyze this image and create an engaging Twitter tweet about it. The tweet should be:
- Maximum 280 characters
- Include relevant hashtags (2-3 max)
- Be engaging and encourage interaction
- Include an emoji at the start
- If there's text in the image (OCR), incorporate the key message
- Describe what you see in an interesting way
- Make it conversational and shareable

Generate only the tweet text, nothing else.`
              },
              {
                inline_data: {
                  mime_type: image.type,
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100,
          }
        })
      })

      const geminiData = await geminiResponse.json()

      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts[0]?.text) {
        const generatedTweet = geminiData.candidates[0].content.parts[0].text.trim()

        // Calculate AI score for image-based tweets (tend to perform well)
        let score = 8.0
        if (generatedTweet.includes('#')) score += 0.5
        if (generatedTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 0.5
        if (generatedTweet.length > 100 && generatedTweet.length < 250) score += 1.0
        if (generatedTweet.includes('?') || generatedTweet.includes('!')) score += 0.5

        const aiScore = Math.min(10, score)

        return Response.json({
          success: true,
          tweet: generatedTweet,
          aiScore: parseFloat(aiScore.toFixed(1)),
          imageAnalysis: "Image analyzed with Gemini Vision"
        })
      } else {
        console.error("Failed to generate tweet with Gemini Vision - no candidates returned")
        return Response.json({
          success: false,
          error: "AI generation failed. Please try again with a different image.",
          message: "The AI service couldn't generate a tweet from the provided image."
        }, { status: 500 })
      }
    } catch (aiError) {
      console.error("Gemini Vision failed:", aiError)
      return Response.json({
        success: false,
        error: "AI service unavailable",
        message: "The AI vision service is currently unavailable. Please try again later."
      }, { status: 503 })
    }

  } catch (error) {
    console.error("Generate from image error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}