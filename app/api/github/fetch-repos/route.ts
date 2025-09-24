import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

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

// Check if repository was already posted
async function isDuplicateRepository(repoUrl: string): Promise<boolean> {
  try {
    const fs = require('fs').promises
    const path = require('path')
    const postedTweetsPath = path.join(process.cwd(), 'data', 'posted-tweets.json')

    try {
      const postedTweetsData = await fs.readFile(postedTweetsPath, 'utf-8')
      const postedTweets = JSON.parse(postedTweetsData)

      // Check if any GitHub tweet has this repository URL
      const isDuplicate = postedTweets.some((tweet: any) =>
        tweet.source === 'github' && (
          tweet.sourceUrl === repoUrl ||
          tweet.sourceUrl?.toLowerCase() === repoUrl.toLowerCase()
        )
      )

      return isDuplicate
    } catch (error) {
      // If file doesn't exist, no duplicates
      return false
    }
  } catch (error) {
    console.error('Duplicate check failed:', error)
    return false
  }
}

// Fetch trending repositories from GitHub
async function fetchTrendingRepos(): Promise<GitHubRepo[]> {
  const trendingRepos: GitHubRepo[] = []

  try {
    // Fetch from multiple sources to get diverse trending repos
    const endpoints = [
      // Search for repos created in last 7 days with high star count
      `https://api.github.com/search/repositories?q=created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=10`,
      // Search for popular repos with good activity
      `https://api.github.com/search/repositories?q=stars:>=1000&pushed:>${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=10`,
      // Search by language for diversity
      `https://api.github.com/search/repositories?q=language:javascript+stars:>=500&sort=updated&order=desc&per_page=5`,
      `https://api.github.com/search/repositories?q=language:python+stars:>=500&sort=updated&order=desc&per_page=5`,
      `https://api.github.com/search/repositories?q=language:typescript+stars:>=300&sort=updated&order=desc&per_page=5`,
      `https://api.github.com/search/repositories?q=language:rust+stars:>=200&sort=updated&order=desc&per_page=5`,
      `https://api.github.com/search/repositories?q=language:go+stars:>=200&sort=updated&order=desc&per_page=5`,
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Tweet-Bot/1.0'
          }
        })

        if (response.ok) {
          const data = await response.json()

          for (const item of data.items) {
            // Check for duplicates before adding
            const isDuplicate = await isDuplicateRepository(item.html_url)

            if (!isDuplicate) {
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
          }
        }
      } catch (error) {
        console.error(`Failed to fetch from ${endpoint}:`, error)
      }
    }
  } catch (error) {
    console.error("Failed to fetch trending repositories:", error)
  }

  return trendingRepos
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return Response.json({ error: "Authentication required" }, { status: 401 })
    }

    const { count = 15 } = await request.json()

    // Fetch trending repositories
    const allTrendingRepos = await fetchTrendingRepos()

    // Remove duplicates and sort by trending score (stars + recent activity)
    const uniqueRepos = allTrendingRepos
      .filter((repo, index, self) => index === self.findIndex(r => r.id === repo.id))

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