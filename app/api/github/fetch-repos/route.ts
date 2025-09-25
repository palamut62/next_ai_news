import type { NextRequest } from "next/server"
// import { checkAuth } from "@/lib/auth"
// import { isDuplicateGitHubRepository } from "@/lib/tweet-storage"
import { supabaseStorage } from "@/lib/supabase-storage"

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
  popularityScore?: number
}

// GitHub Trending repoları çek
async function fetchTrendingRepos(): Promise<GitHubRepo[]> {
  const trendingRepos: GitHubRepo[] = []

  try {
    console.log("🔑 GitHub token available:", process.env.GITHUB_TOKEN ? "YES" : "NO")

    // Haftalık trending repolar için stratejiler
    const strategies = [
      // Strateji 1: Son 7 günde oluşturulan en popüler repolar
      {
        name: "weekly new",
        endpoint: `https://api.github.com/search/repositories?q=created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=15`,
        description: "Son 7 günde oluşturulan en çok star alan repolar"
      },
      // Strateji 2: Son 7 günde güncellenen aktif repolar
      {
        name: "weekly active",
        endpoint: `https://api.github.com/search/repositories?q=pushed:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}+stars:>=50&sort=updated&order=desc&per_page=15`,
        description: "Son 7 günde güncellenen aktif repolar"
      },
      // Strateji 3: Popüler dillerde haftalık trending
      {
        name: "trending languages",
        endpoints: [
          `https://api.github.com/search/repositories?q=language:javascript+created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=3`,
          `https://api.github.com/search/repositories?q=language:python+created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=3`,
          `https://api.github.com/search/repositories?q=language:typescript+created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=3`,
          `https://api.github.com/search/repositories?q=language:go+created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=3`,
          `https://api.github.com/search/repositories?q=language:rust+created:>${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=stars&order=desc&per_page=3`,
        ]
      }
    ]

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Tweet-Bot/1.0',
    }

    const fetchOptions: RequestInit = { headers }

    // fetch with timeout helper
    async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = 20000) {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeout)
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal })
        clearTimeout(id)
        return res
      } catch (err) {
        clearTimeout(id)
        throw err
      }
    }

    // Temporarily disable authentication to test functionality
    // if (process.env.GITHUB_TOKEN) {
    //   headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
    // }

    // Her stratejiyi uygula
    for (const strategy of strategies) {
      try {
        // If this strategy provides multiple endpoints, iterate them safely
          if (Array.isArray((strategy as any).endpoints)) {
          // Dil bazlı arama için
          for (const endpoint of (strategy as any).endpoints) {
            try {
              console.log(`📡 Fetching from ${endpoint.split('?q=')[1].split('&')[0]}`)
              const response = await fetchWithTimeout(endpoint, fetchOptions, 20000)
              const text = await response.text()

              if (!response.ok) {
                console.warn(`❌ Failed to fetch from ${endpoint}: ${response.status} ${response.statusText}`)
                console.warn('Response body (first 1000 chars):', text.slice(0, 1000))
                continue
              }

              let data: any = {}
              try { data = JSON.parse(text) } catch { data = {} }

              if (!data.items || !Array.isArray(data.items)) {
                console.warn(`❌ No items in response for ${endpoint}`)
                continue
              }

              console.log(`✅ Found ${data.items.length} repositories from ${endpoint.split('?q=')[1].split('&')[0]}`)

              for (const item of data.items) {
                const trendingScore = calculateTrendingScore(item, 7) // 7 günlük trend skoru

                trendingRepos.push({
                  id: item.id.toString(),
                  name: item.name,
                  fullName: item.full_name,
                  description: item.description || "No description available",
                  stars: item.stargazers_count,
                  forks: item.forks_count,
                  language: item.language,
                  url: item.html_url,
                  updatedAt: item.updated_at,
                  popularityScore: trendingScore
                })
              }
            } catch (err) {
              console.error(`❌ Error fetching from ${endpoint}:`, err)
            }
          }
          } else {
          // Normal endpointler için
          console.log(`📡 Fetching ${strategy.name}: ${strategy.description}`)

          if (!strategy.endpoint) {
            console.warn(`⚠️ Strategy ${strategy.name} has no endpoint, skipping`)
            continue
          }
          const response = await fetchWithTimeout(strategy.endpoint, fetchOptions, 20000)
          const text = await response.text()

          if (!response.ok) {
            console.warn(`❌ Failed to fetch ${strategy.name}: ${response.status} ${response.statusText}`)
            console.warn('Response body (first 1000 chars):', text.slice(0, 1000))
            continue
          }

          let data: any = {}
          try { data = JSON.parse(text) } catch { data = {} }

          if (!data.items || !Array.isArray(data.items)) {
            console.warn(`❌ No items in response for ${strategy.name}`)
            continue
          }

          console.log(`✅ Found ${data.items.length} repositories for ${strategy.name}`)

          for (const item of data.items) {
            const trendingScore = calculateTrendingScore(item, 7) // 7 günlük trend skoru

            trendingRepos.push({
              id: item.id.toString(),
              name: item.name,
              fullName: item.full_name,
              description: item.description || "No description available",
              stars: item.stargazers_count,
              forks: item.forks_count,
              language: item.language,
              url: item.html_url,
              updatedAt: item.updated_at,
              popularityScore: trendingScore
            })
          }
        }
      } catch (err) {
        console.error(`❌ Error with strategy ${strategy.name}:`, err)
      }
    }

    console.log(`📊 Total repositories collected: ${trendingRepos.length}`)

  } catch (error) {
    console.error("❌ Failed to fetch trending repositories:", error)
  }

  return trendingRepos
}

// Trend skoru hesaplama fonksiyonu
function calculateTrendingScore(item: any, daysAgo: number): number {
  const daysSinceCreated = Math.max(1, (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const daysSinceUpdated = Math.max(1, (Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60 * 60 * 24))

  // Trend skoru: günlük star oranı + günlük fork oranı + güncellik bonusu
  const dailyStars = item.stargazers_count / daysSinceCreated
  const dailyForks = item.forks_count / daysSinceCreated
  const recencyBonus = daysSinceUpdated <= 7 ? 50 : daysSinceUpdated <= 30 ? 25 : 0

  return (dailyStars * 10) + (dailyForks * 5) + recencyBonus
}

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 GitHub fetch repos API called")

    const { count = 15 } = await request.json()
    console.log(`📋 Fetching ${count} repositories`)

    // Fetch trending repositories
    const allTrendingRepos = await fetchTrendingRepos()
    console.log(`✅ Found ${allTrendingRepos.length} trending repositories`)

    if (allTrendingRepos.length === 0) {
      console.log("❌ No repositories found, returning empty result")
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

    // Remove duplicates
    const uniqueRepos = allTrendingRepos
      .filter((repo, index, self) => index === self.findIndex(r => r.id === repo.id))

    console.log(`🔄 After duplicate removal: ${uniqueRepos.length} unique repositories`)

    // Filter out rejected repositories
    const nonRejectedRepos = []
    let rejectedCount = 0

    for (const repo of uniqueRepos) {
      const isRejected = await supabaseStorage.isGitHubRepoRejected(repo.fullName, repo.url)
      if (!isRejected) {
        nonRejectedRepos.push(repo)
      } else {
        rejectedCount++
      }
    }

    // Sort by popularity score
    const finalRepos = nonRejectedRepos
      .sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0))
      .slice(0, count)

    console.log(`🎯 Returning ${finalRepos.length} repositories`)
    console.log(`🏆 Top repo: ${finalRepos[0]?.fullName} (${finalRepos[0]?.stars} stars)`)
    console.log(`🚫 Filtered out ${rejectedCount} rejected repositories`)

    return Response.json({
      success: true,
      repos: finalRepos,
      totalFound: finalRepos.length,
      rejectedCount: rejectedCount,
      filters: {
        totalProcessed: allTrendingRepos.length,
        duplicatesRemoved: allTrendingRepos.length - uniqueRepos.length,
        rejectedRemoved: rejectedCount,
        message: `Fetched trending repositories from multiple strategies: monthly stars, forks, and language trends`
      }
    })

  } catch (error) {
    console.error("❌ Fetch GitHub repos error:", error)
    return Response.json({
      error: "Failed to fetch repositories",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}