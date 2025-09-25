import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, securityMiddleware } from './rate-limiter'
import { checkAuth } from './auth'
import { logSecurityEvent, logAPIEvent } from './audit-logger'
import { validateInput } from './input-validation'

// Security middleware for API routes
export async function applySecurityMiddleware(
  request: NextRequest,
  options: {
    requireAuth?: boolean
    rateLimitType?: keyof typeof rateLimiters
    validateInput?: boolean
    logActivity?: boolean
    adminOnly?: boolean
  } = {}
): Promise<{ response: NextResponse | null; authResult?: any }> {
  const {
    requireAuth = false,
    rateLimitType = 'api',
    validateInput = false,
    logActivity = true,
    adminOnly = false
  } = options

  try {
    // Apply security headers and basic checks
    const securityCheck = securityMiddleware(request)
    if (securityCheck && securityCheck.status !== 200) {
      if (logActivity) {
        await logSecurityEvent('suspicious_activity', 'warning', request, {
          url: request.url,
          method: request.method,
          status: securityCheck.status
        })
      }
      return { response: NextResponse.json({ error: 'Security check failed' }, { status: 403 }) }
    }

    // Apply rate limiting
    if (rateLimitType) {
      const rateLimiter = rateLimiters[rateLimitType]
      const rateLimitCheck = await rateLimiter.checkLimit(request)

      if (!rateLimitCheck.allowed) {
        if (logActivity) {
          await logSecurityEvent('security_alert', 'warning', request, {
            type: 'rate_limit_exceeded',
            rateLimitType,
            retryAfter: rateLimitCheck.retryAfter
          })
        }

        return {
          response: NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: rateLimitCheck.retryAfter,
              resetTime: rateLimitCheck.resetTime
            },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': rateLimiter.config.maxRequests.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': rateLimitCheck.resetTime.toString(),
                'Retry-After': (rateLimitCheck.retryAfter || 60).toString()
              }
            }
          )
        }
      }
    }

    // Check authentication if required
    let authResult = null
    if (requireAuth) {
      authResult = await checkAuth(request)
      if (!authResult.authenticated) {
        if (logActivity) {
          await logAuthEvent('login_failure', false, request, {
            url: request.url,
            method: request.method,
            reason: 'authentication_required'
          })
        }

        return {
          response: NextResponse.json(
            { error: 'Authentication required' },
            {
              status: 401,
              headers: {
                'WWW-Authenticate': 'Bearer',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
              }
            }
          )
        }
      }

      // Check admin access if required
      if (adminOnly) {
        // Add admin check logic here
        // For now, we'll assume admin check is implemented elsewhere
        if (logActivity) {
          await logSecurityEvent('security_alert', 'warning', request, {
            type: 'admin_access_attempt',
            userId: authResult.email,
            url: request.url
          })
        }
      }
    }

    // Validate input if required
    if (validateInput && request.method === 'POST') {
      try {
        const body = await request.json()

        // Validate common input types
        if (body.content) {
          const validation = validateInput(body.content, 'tweet')
          if (!validation.valid) {
            if (logActivity) {
              await logSecurityEvent('suspicious_activity', 'warning', request, {
                type: 'invalid_input',
                field: 'content',
                errors: validation.errors
              })
            }

            return {
              response: NextResponse.json(
                { error: 'Invalid input', details: validation.errors },
                { status: 400 }
              )
            }
          }
        }

        if (body.email) {
          const validation = validateInput(body.email, 'email')
          if (!validation.valid) {
            if (logActivity) {
              await logSecurityEvent('suspicious_activity', 'warning', request, {
                type: 'invalid_input',
                field: 'email',
                errors: validation.errors
              })
            }

            return {
              response: NextResponse.json(
                { error: 'Invalid email', details: validation.errors },
                { status: 400 }
              )
            }
        }

        if (body.url) {
          const validation = validateInput(body.url, 'url')
          if (!validation.valid) {
            if (logActivity) {
              await logSecurityEvent('suspicious_activity', 'warning', request, {
                type: 'invalid_input',
                field: 'url',
                errors: validation.errors
              })
            }

            return {
              response: NextResponse.json(
                { error: 'Invalid URL', details: validation.errors },
                { status: 400 }
              )
            }
          }

        }

      } catch (error) {
        if (logActivity) {
          await logSecurityEvent('suspicious_activity', 'warning', request, {
            type: 'invalid_json',
            error: error instanceof Error ? error.message : 'Invalid JSON'
          })
        }

        return {
          response: NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
          )
        }
      }
    }

    // Log successful access
    if (logActivity) {
      await logAPIEvent(
        'api_access',
        true,
        request,
        {
          method: request.method,
          url: request.url,
          authenticated: authResult?.authenticated || false,
          userId: authResult?.email
        }
      )
    }

    return { response: null, authResult }

  } catch (error) {
    console.error('Security middleware error:', error)

    if (logActivity) {
      await logSecurityEvent('security_alert', 'error', request, {
        type: 'middleware_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return {
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

// Helper function to create secured API route handler
export function createSecureHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean
    rateLimitType?: keyof typeof rateLimiters
    validateInput?: boolean
    logActivity?: boolean
    adminOnly?: boolean
  } = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Apply security middleware
    const { response: securityResponse, authResult } = await applySecurityMiddleware(request, options)

    // If security middleware returned a response, return it
    if (securityResponse) {
      // Record the request in rate limiter
      if (options.rateLimitType) {
        const rateLimiter = rateLimiters[options.rateLimitType]
        await rateLimiter.recordRequest(request, false)
      }
      return securityResponse
    }

    try {
      // Call the original handler
      const response = await handler(request, context)

      // Record successful request in rate limiter
      if (options.rateLimitType) {
        const rateLimiter = rateLimiters[options.rateLimitType]
        await rateLimiter.recordRequest(request, response.status < 400)
      }

      // Apply security headers to response
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

      // Add auth info to response if authenticated
      if (authResult?.authenticated) {
        headers.set('X-Auth-Status', 'authenticated')
        if (authResult.email) {
          // Don't include actual email, just a hash for privacy
          const emailHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(authResult.email))
          headers.set('X-User-Hash', Buffer.from(emailHash).toString('hex').substring(0, 8))
        }
      }

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })

    } catch (error) {
      console.error('Handler error:', error)

      // Record failed request in rate limiter
      if (options.rateLimitType) {
        const rateLimiter = rateLimiters[options.rateLimitType]
        await rateLimiter.recordRequest(request, false)
      }

      // Log the error
      if (options.logActivity) {
        await logAPIEvent('api_error', false, request, {
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: authResult?.email
        })
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

// Pre-configured middleware creators
export const withAuth = (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
  createSecureHandler(handler, { requireAuth: true })

export const withAdminAuth = (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
  createSecureHandler(handler, { requireAuth: true, adminOnly: true })

export const withRateLimit = (type: keyof typeof rateLimiters) =>
  (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    createSecureHandler(handler, { rateLimitType: type })

export const withValidation = (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
  createSecureHandler(handler, { validateInput: true })

// Composed middleware for common scenarios
export const withAuthAndValidation = (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
  createSecureHandler(handler, { requireAuth: true, validateInput: true })

export const withAuthAndRateLimit = (type: keyof typeof rateLimiters) =>
  (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    createSecureHandler(handler, { requireAuth: true, rateLimitType: type })

export const withFullSecurity = (type: keyof typeof rateLimiters = 'api') =>
  (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    createSecureHandler(handler, { requireAuth: true, rateLimitType: type, validateInput: true })

// Error handling wrapper
export function withErrorHandling(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('Unhandled error in API route:', error)

      // Don't leak sensitive error details in production
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error instanceof Error
        ? error.message
        : 'Unknown error'

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  }
}