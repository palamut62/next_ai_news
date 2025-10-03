import { NextResponse } from 'next/server'
import { newsDuplicateDetector } from '@/lib/news-duplicate-detector'

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function GET() {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        newsApiKeyConfigured: !!process.env.NEWS_API_KEY,
        githubTokenConfigured: !!process.env.GITHUB_TOKEN,
        openaiKeyConfigured: !!process.env.OPENAI_API_KEY,
        supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
      },
      duplicateDetection: {
        status: 'unknown',
        processedCount: 0,
        lastCacheUpdate: null
      },
      apis: {
        status: 'unknown',
        results: {}
      }
    }

    // Test duplicate detection system
    try {
      const stats = await newsDuplicateDetector.getStats()
      healthCheck.duplicateDetection = {
        status: 'healthy',
        processedCount: stats.totalProcessed,
        duplicatesDetected: stats.duplicatesDetected,
        uniqueSources: stats.uniqueSources.length,
        lastCacheUpdate: new Date().toISOString()
      }
    } catch (error) {
      healthCheck.duplicateDetection.status = 'error'
      healthCheck.duplicateDetection.error = error instanceof Error ? error.message : 'Unknown error'
    }

    // Quick API connectivity tests
    const apiTests = [
      { name: 'newsApi', url: 'https://newsapi.org/v2/top-headlines?country=us&pageSize=1' },
      { name: 'techcrunch', url: 'https://techcrunch.com/feed/' },
      { name: 'github', url: 'https://api.github.com/rate_limit' }
    ]

    for (const api of apiTests) {
      try {
        const start = Date.now()
        const response = await fetch(api.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        const latency = Date.now() - start

        healthCheck.apis.results[api.name] = {
          status: response.ok ? 'healthy' : 'error',
          latency,
          httpStatus: response.status
        }
      } catch (error) {
        healthCheck.apis.results[api.name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    healthCheck.apis.status = Object.values(healthCheck.apis.results).every(r => r.status === 'healthy')
      ? 'healthy'
      : 'degraded'

    // Overall health status
    const allHealthy = [
      healthCheck.duplicateDetection.status === 'healthy',
      healthCheck.apis.status !== 'error'
    ].every(Boolean)

    healthCheck.status = allHealthy ? 'healthy' : 'degraded'

    return NextResponse.json(healthCheck, {
      status: allHealthy ? 200 : 503,
      headers: CORS_HEADERS
    })

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 503,
      headers: CORS_HEADERS
    })
  }
}

export async function POST() {
  return GET()
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}