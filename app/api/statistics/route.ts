import { type NextRequest, NextResponse } from "next/server"
import { checkAuth, requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return requireAuth()
  }

  const { searchParams } = new URL(request.url)
  const timeRange = searchParams.get("timeRange") || "7d"

  // In a real app, this would fetch statistics from your database
  const statistics = {
    overview: {
      totalTweets: 1247,
      avgEngagement: 8.4,
      successRate: 94.5,
      totalReach: 125000,
    },
    tweetVolume: [
      { date: "Jan 1", tweets: 12, approved: 10, posted: 8 },
      { date: "Jan 2", tweets: 15, approved: 13, posted: 11 },
      // ... more data
    ],
    engagement: [
      { date: "Jan 1", likes: 245, retweets: 89, replies: 34 },
      { date: "Jan 2", likes: 312, retweets: 156, replies: 67 },
      // ... more data
    ],
    sourceDistribution: [
      { name: "TechCrunch", value: 65 },
      { name: "GitHub", value: 35 },
    ],
    languageDistribution: [
      { name: "JavaScript", value: 28 },
      { name: "Python", value: 24 },
      // ... more data
    ],
    topTweets: [
      {
        id: "1",
        content: "🚀 Revolutionary AI breakthrough...",
        likes: 1247,
        retweets: 456,
        replies: 89,
        engagement: 12.4,
      },
      // ... more tweets
    ],
  }

  return NextResponse.json(statistics)
}
