import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("🔑 GitHub token available:", process.env.GITHUB_TOKEN ? "YES" : "NO")
    console.log("📡 Making test API call...")

    const response = await fetch("https://api.github.com/search/repositories?q=stars:>=1000&sort=stars&order=desc&per_page=5", {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Tweet-Bot/1.0',
      }
    })

    console.log("📊 Response status:", response.status)

    if (!response.ok) {
      console.error("❌ API call failed:", response.statusText)
      return Response.json({ error: "API call failed" }, { status: 500 })
    }

    const data = await response.json()
    console.log("✅ API call successful, items:", data.items?.length || 0)

    return Response.json({
      success: true,
      repos: data.items || [],
      totalFound: data.items?.length || 0,
      debug: {
        tokenAvailable: process.env.GITHUB_TOKEN ? "YES" : "NO",
        responseStatus: response.status
      }
    })

  } catch (error) {
    console.error("❌ Test failed:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}