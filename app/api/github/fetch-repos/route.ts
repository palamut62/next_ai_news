import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { isDuplicateGitHubRepository } from "@/lib/tweet-storage"

interface GitHubRepo {
  id: string
  name: string
  fullName: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  url: string
  updatedAt: string
}

// Fetch trending repositories from GitHub
async function fetchTrendingRepos(): Promise<GitHubRepo[]> {
  const trendingRepos: GitHubRepo[] = []

  try {
    console.log("🔑 GitHub token available:", process.env.GITHUB_TOKEN ? "YES" : "NO")

    // Simplified: Use a single endpoint for testing
    const endpoint = `https://api.github.com/search/repositories?q=stars:>=1000&sort=stars&order=desc&per_page=15`

    console.log("📡 Fetching from:", endpoint)

    // Try without token first, fallback to token if available
    const githubToken = process.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Tweet-Bot/1.0',
    }

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`
    }

    const response = await fetch(endpoint, { headers })

    console.log(`🔑 Using token: ${process.env.GITHUB_TOKEN ? 'YES' : 'NO'}`)
    console.log(`📊 Response status: ${response.status}`)

    if (!response.ok) {
      console.error(`GitHub API responded with ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    console.log(`📊 Total items found: ${data.total_count}`)
    console.log(`📊 Items in response: ${data.items?.length || 0}`)

    if (!data || !Array.isArray(data.items)) {
      console.warn(`GitHub response did not contain items array`)
      return []
    }

    for (const item of data.items) {
      // Temporarily disable duplicate checking for testing
      trendingRepos.push({
        id: item.id.toString(),
        name: item.name,
        fullName: item.full_name,
        description: item.description || "No description available",
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language,
        url: item.html_url,
        updatedAt: item.updated_at
      })
    }
  } catch (error) {
    console.error("Failed to fetch trending repositories:", error)
  }

  return trendingRepos
}

export async function POST(request: NextRequest) {
  try {
    console.log("GitHub fetch repos API called")

    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   console.log("Authentication failed for GitHub fetch repos")
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { count = 15 } = await request.json()
    console.log(`Fetching ${count} repositories`)

    // Fetch trending repositories
    const allTrendingRepos = await fetchTrendingRepos()
    console.log(`Found ${allTrendingRepos.length} trending repositories`)

    if (allTrendingRepos.length === 0) {
      console.log("No repositories found, returning empty result")
      return Response.json({
        success: true,
        repos: [],
        totalFound: 0,
        filters: {
          totalProcessed: 0,
          duplicatesRemoved: 0,
          message: "No repositories found"
        }
      })
    }

    // Remove duplicates and sort by trending score (stars + recent activity)
    const uniqueRepos = allTrendingRepos
      .filter((repo, index, self) => index === self.findIndex(r => r.id === repo.id))

    console.log(`After duplicate removal: ${uniqueRepos.length} unique repositories`)

    // Calculate trending score and sort
    const reposWithScore = uniqueRepos.map(repo => {
      const daysSinceUpdated = Math.max(1, (Date.now() - new Date(repo.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      const trendingScore = (repo.stars * 0.7) + (repo.forks * 0.2) + (100 / daysSinceUpdated * 0.1)
      return { ...repo, trendingScore }
    })

    // Sort by trending score and limit results
    const finalRepos = reposWithScore
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, count)

    console.log(`Returning ${finalRepos.length} repositories`)

    return Response.json({
      success: true,
      repos: finalRepos,
      totalFound: finalRepos.length,
      filters: {
        totalProcessed: allTrendingRepos.length,
        duplicatesRemoved: allTrendingRepos.length - uniqueRepos.length
      }
    })

  } catch (error) {
    console.error("Fetch GitHub repos error:", error)
    return Response.json({
      error: "Failed to fetch repositories",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}