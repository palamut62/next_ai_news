import { checkRateLimitAdvanced, cleanupRateLimits } from './security-utils'
import fs from 'fs/promises'
import path from 'path'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: Request) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
  message?: string // Custom error message
}

interface RateLimitRecord {
  count: number
  resetTime: number
  windowStart: number
  blocked: boolean
}

class RateLimiter {
  private store: Map<string, RateLimitRecord> = new Map()
  private readonly storageFile = path.join(process.cwd(), 'data', 'rate-limits.json')
  private config: Required<RateLimitConfig>

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      message: config.message || 'Too many requests, please try again later.'
    }

    // Load existing data
    this.loadData()

    // Periodic cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // Every 5 minutes
  }

  private defaultKeyGenerator(request: Request): string {
    // Get IP address from various headers
    const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                request.headers.get('cf-connecting-ip') ||
                'unknown'

    // Get user agent for additional context
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get endpoint path
    const url = new URL(request.url)
    const endpoint = url.pathname

    // Combine IP and endpoint for specific rate limiting
    return `${ip}:${endpoint}:${userAgent.slice(0, 50)}`
  }

  private async loadData(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storageFile), { recursive: true })
      const data = await fs.readFile(this.storageFile, 'utf-8')
      const records = JSON.parse(data)

      this.store = new Map(
        Object.entries(records).map(([key, record]: [string, any]) => [
          key,
          {
            ...record,
            resetTime: new Date(record.resetTime).getTime(),
            windowStart: new Date(record.windowStart).getTime()
          }
        ])
      )
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load rate limit data:', error)
      }
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storageFile), { recursive: true })
      const data = Object.fromEntries(this.store.entries())
      await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save rate limit data:', error)
    }
  }

  private cleanup(): void {
    const now = Date.now()

    for (const [key, record] of this.store.entries()) {
      if (now - record.windowStart > this.config.windowMs) {
        this.store.delete(key)
      }
    }

    // Persist cleaned data
    this.saveData().catch(console.error)
  }

  async checkLimit(request: Request): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
    retryAfter?: number
  }> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()
    let record = this.store.get(key)

    // Create new record if it doesn't exist or window has expired
    if (!record || now - record.windowStart > this.config.windowMs) {
      record = {
        count: 0,
        resetTime: now + this.config.windowMs,
        windowStart: now,
        blocked: false
      }
      this.store.set(key, record)
    }

    // Check if blocked
    if (record.blocked) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter
      }
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxRequests) {
      record.blocked = true
      this.store.set(key, record)
      await this.saveData()

      const retryAfter = Math.ceil((record.resetTime - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter
      }
    }

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.resetTime
    }
  }

  async recordRequest(request: Request, success: boolean = true): Promise<void> {
    const key = this.config.keyGenerator(request)
    const record = this.store.get(key)

    if (!record) {
      return
    }

    // Skip based on configuration
    if (this.config.skipSuccessfulRequests && success) {
      return
    }

    if (this.config.skipFailedRequests && !success) {
      return
    }

    record.count++
    this.store.set(key, record)
    await this.saveData()
  }

  async resetLimit(key?: string): Promise<void> {
    if (key) {
      this.store.delete(key)
    } else {
      this.store.clear()
    }
    await this.saveData()
  }

  async getStats(): Promise<{
    totalKeys: number
    activeKeys: number
    blockedKeys: number
    averageUsage: number
  }> {
    const now = Date.now()
    let totalKeys = this.store.size
    let activeKeys = 0
    let blockedKeys = 0
    let totalUsage = 0

    for (const [key, record] of this.store.entries()) {
      if (now - record.windowStart <= this.config.windowMs) {
        activeKeys++
        totalUsage += record.count
      }

      if (record.blocked) {
        blockedKeys++
      }
    }

    return {
      totalKeys,
      activeKeys,
      blockedKeys,
      averageUsage: activeKeys > 0 ? totalUsage / activeKeys : 0
    }
  }

  // Middleware factory for Next.js API routes
  middleware() {
    return async (request: Request, response?: Response): Promise<Response | null> => {
      const check = await this.checkLimit(request)

      if (!check.allowed) {
        return new Response(JSON.stringify({
          error: this.config.message,
          retryAfter: check.retryAfter,
          resetTime: check.resetTime
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': check.resetTime.toString(),
            'Retry-After': check.retryAfter?.toString() || '60',
            ...this.getSecurityHeaders()
          }
        })
      }

      // Add rate limit headers to successful responses
      if (response) {
        const newHeaders = new Headers(response.headers)
        newHeaders.set('X-RateLimit-Limit', this.config.maxRequests.toString())
        newHeaders.set('X-RateLimit-Remaining', check.remaining.toString())
        newHeaders.set('X-RateLimit-Reset', check.resetTime.toString())

        // Return response with updated headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        })
      }

      return null
    }
  }

  private getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // General API rate limiting
  api: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'API rate limit exceeded. Please wait before making more requests.'
  }),

  // Authentication rate limiting
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true
  }),

  // OTP rate limiting
  otp: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3,
    message: 'Too many OTP requests. Please wait before requesting another code.',
    skipSuccessfulRequests: false
  }),

  // Tweet posting rate limiting
  tweet: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: 'Tweet posting limit reached. Please wait before posting more tweets.'
  }),

  // File upload rate limiting
  upload: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Upload limit reached. Please wait before uploading more files.'
  }),

  // Email sending rate limiting
  email: new RateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 100,
    message: 'Email sending limit reached. Please wait before sending more emails.'
  })
}

// Security middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config)
  return limiter.middleware()
}

// Security headers middleware
export function securityHeadersMiddleware(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)

  // Security headers
  headers.set('Content-Security-Policy', \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none';\")
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')

  // Remove potentially dangerous headers
  headers.delete('X-Powered-By')
  headers.delete('Server')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// IP-based security middleware
export function ipSecurityMiddleware(request: Request, response: Response): Response | null {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             request.headers.get('cf-connecting-ip')

  if (!ip) {
    return response
  }

  // Check for suspicious IPs
  const suspiciousPatterns = [
    /^192\.168\./, // Private networks
    /^10\./,       // Private networks
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private networks
    /^127\./,      // Loopback
    /^0\./,        // Reserved
    /^169\.254\./, // Link-local
    /^::1$/,       // IPv6 loopback
    /^fc00:/,      // IPv6 private
    /^fe80:/       // IPv6 link-local
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(ip)) {
      // Log suspicious IP access
      console.warn(`Suspicious IP access attempt: ${ip}`)

      // Optionally block the request
      // return new Response('Access denied', { status: 403 })
    }
  }

  return null
}

// Request validation middleware
export function requestValidationMiddleware(request: Request): Response | null {
  // Check request size
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    return new Response('Request too large', { status: 413 })
  }

  // Check content type
  const contentType = request.headers.get('content-type')
  if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return new Response('Unsupported content type', { status: 415 })
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-host', 'x-rewrite-url']
  for (const header of suspiciousHeaders) {
    if (request.headers.get(header)) {
      console.warn(`Suspicious header detected: ${header}`)
      // Optionally block the request
      // return new Response('Invalid request', { status: 400 })
    }
  }

  return null
}

// Combined security middleware
export function securityMiddleware(request: Request, response?: Response): Response | null {
  // Apply IP security
  const ipResponse = ipSecurityMiddleware(request, response || new Response())
  if (ipResponse) return ipResponse

  // Apply request validation
  const validationResponse = requestValidationMiddleware(request)
  if (validationResponse) return validationResponse

  // Apply security headers if response exists
  if (response) {
    return securityHeadersMiddleware(request, response)
  }

  return null
}