import { NextRequest, NextResponse } from 'next/server'

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 Testing API connectivity...")

    const results = {
      timestamp: new Date().toISOString(),
      connectivity: {
        newsApi: { status: 'unknown', message: '', latency: 0 },
        techcrunchRss: { status: 'unknown', message: '', latency: 0 },
        githubApi: { status: 'unknown', message: '', latency: 0 },
        fileSystem: { status: 'unknown', message: '' }
      },
      environment: {
        newsApiKey: !!process.env.NEWS_API_KEY,
        githubToken: !!process.env.GITHUB_TOKEN,
        nodeEnv: process.env.NODE_ENV,
        platform: process.platform
      }
    }

    // Test NewsAPI connectivity
    try {
      const newsApiStart = Date.now()
      const newsResponse = await fetch('https://newsapi.org/v2/top-headlines?country=us&pageSize=1', {
        headers: process.env.NEWS_API_KEY ? { 'X-API-Key': process.env.NEWS_API_KEY } : {}
      })
      const newsLatency = Date.now() - newsApiStart

      if (newsResponse.ok) {
        const data = await newsResponse.json()
        results.connectivity.newsApi = {
          status: 'success',
          message: `Connected successfully (${data.articles?.length || 0} articles)`,
          latency: newsLatency
        }
      } else {
        results.connectivity.newsApi = {
          status: 'error',
          message: `HTTP ${newsResponse.status}: ${newsResponse.statusText}`,
          latency: newsLatency
        }
      }
    } catch (error) {
      results.connectivity.newsApi = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: 0
      }
    }

    // Test TechCrunch RSS connectivity
    try {
      const rssStart = Date.now()
      const rssResponse = await fetch('https://techcrunch.com/feed/', { timeout: 5000 })
      const rssLatency = Date.now() - rssStart

      if (rssResponse.ok) {
        const text = await rssResponse.text()
        const itemMatches = text.match(/<item>/g)
        results.connectivity.techcrunchRss = {
          status: 'success',
          message: `RSS feed accessible (${itemMatches?.length || 0} items)`,
          latency: rssLatency
        }
      } else {
        results.connectivity.techcrunchRss = {
          status: 'error',
          message: `HTTP ${rssResponse.status}: ${rssResponse.statusText}`,
          latency: rssLatency
        }
      }
    } catch (error) {
      results.connectivity.techcrunchRss = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: 0
      }
    }

    // Test GitHub API connectivity
    try {
      const githubStart = Date.now()
      const githubResponse = await fetch('https://api.github.com/rate_limit', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
        }
      })
      const githubLatency = Date.now() - githubStart

      if (githubResponse.ok) {
        const data = await githubResponse.json()
        results.connectivity.githubApi = {
          status: 'success',
          message: `API accessible (remaining: ${data.resources?.core?.remaining || 'unknown'})`,
          latency: githubLatency
        }
      } else {
        results.connectivity.githubApi = {
          status: 'error',
          message: `HTTP ${githubResponse.status}: ${githubResponse.statusText}`,
          latency: githubLatency
        }
      }
    } catch (error) {
      results.connectivity.githubApi = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        latency: 0
      }
    }

    // Test file system access
    try {
      const fs = require('fs/promises')
      const path = require('path')

      const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')

      try {
        await fs.access(tmpDir)
        const testFile = path.join(tmpDir, 'test-connectivity.json')
        await fs.writeFile(testFile, JSON.stringify({ test: 'connectivity', timestamp: new Date().toISOString() }))
        await fs.unlink(testFile)

        results.connectivity.fileSystem = {
          status: 'success',
          message: `Directory writable: ${tmpDir}`
        }
      } catch (fsError) {
        results.connectivity.fileSystem = {
          status: 'error',
          message: `File system error: ${fsError instanceof Error ? fsError.message : 'Unknown error'}`
        }
      }
    } catch (error) {
      results.connectivity.fileSystem = {
        status: 'error',
        message: `FS module error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    console.log('🔍 Connectivity test completed:', results)

    return NextResponse.json({
      success: true,
      results
    }, { headers: CORS_HEADERS })

  } catch (error) {
    console.error('❌ Connectivity test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}