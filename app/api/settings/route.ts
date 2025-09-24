import { type NextRequest, NextResponse } from "next/server"
import { checkAuth, requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return requireAuth()
  }

  // In a real app, this would fetch settings from your database
  const settings = {
    automation: {
      enabled: true,
      checkInterval: 2,
      maxArticlesPerCheck: 10,
      minAiScore: 7.0,
      autoPost: false,
      requireApproval: true,
      rateLimitDelay: 30,
    },
    // ... other settings
  }

  return NextResponse.json(settings)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return requireAuth()
  }

  const settings = await request.json()

  // In a real app, this would save settings to your database
  // Validate and sanitize the settings here

  return NextResponse.json({ success: true, message: "Settings saved successfully" })
}
