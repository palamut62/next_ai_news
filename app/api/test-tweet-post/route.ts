import { type NextRequest, NextResponse } from "next/server"
import { postTextTweetV2 } from "@/lib/twitter-v2-client"

export async function POST(request: NextRequest) {
  try {
    const { content, sourceUrl, hashtags } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: "Tweet content is required" },
        { status: 400 }
      )
    }

    console.log("🧪 TEST: Calling postTextTweetV2 with:", { content, sourceUrl, hashtags })

    const result = await postTextTweetV2(content, sourceUrl, hashtags)

    console.log("🧪 TEST: postTextTweetV2 returned:", result)

    return NextResponse.json({
      success: true,
      message: "Test tweet post attempt completed",
      result,
    })
  } catch (error) {
    console.error("🧪 TEST: Error:", error)
    return NextResponse.json(
      {
        error: "Test failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
