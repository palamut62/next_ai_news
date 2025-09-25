import nodemailer from "nodemailer"
import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

interface OTPSession {
  email: string
  otp: string
  expiresAt: number
  attempts: number
  sessionId: string
  createdAt: number
}

interface SessionData {
  sessionId: string
  email: string
  createdAt: number
  lastAccess: number
}

// Secure session storage with file persistence
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json")
const OTP_SESSIONS_FILE = path.join(process.cwd(), "data", "otp-sessions.json")

// Rate limiting configuration
const RATE_LIMITS = {
  otpRequests: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3
  },
  loginAttempts: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5
  }
}

interface RateLimitData {
  attempts: number
  windowStart: number
}

const rateLimits = new Map<string, RateLimitData>()

// Secure session management
async function loadSessions(): Promise<Map<string, SessionData>> {
  try {
    await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true })
    const data = await fs.readFile(SESSIONS_FILE, "utf-8")
    const sessions = JSON.parse(data)
    return new Map(sessions.map((s: any) => [s.sessionId, s]))
  } catch {
    return new Map()
  }
}

async function saveSessions(sessions: Map<string, SessionData>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true })
    const data = Array.from(sessions.values())
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error("Failed to save sessions:", error)
  }
}

// Secure OTP session management
async function loadOTPSessions(): Promise<Map<string, OTPSession>> {
  try {
    await fs.mkdir(path.dirname(OTP_SESSIONS_FILE), { recursive: true })
    const data = await fs.readFile(OTP_SESSIONS_FILE, "utf-8")
    const sessions = JSON.parse(data)
    return new Map(sessions.map((s: any) => [s.sessionId, s]))
  } catch {
    return new Map()
  }
}

async function saveOTPSessions(sessions: Map<string, OTPSession>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(OTP_SESSIONS_FILE), { recursive: true })
    const data = Array.from(sessions.values())
    await fs.writeFile(OTP_SESSIONS_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error("Failed to save OTP sessions:", error)
  }
}

// Clean expired sessions
async function cleanupExpiredSessions(): Promise<void> {
  try {
    const sessions = await loadSessions()
    const now = Date.now()

    for (const [sessionId, session] of sessions) {
      if (now - session.lastAccess > 24 * 60 * 60 * 1000) { // 24 hours
        sessions.delete(sessionId)
      }
    }

    await saveSessions(sessions)
  } catch (error) {
    console.error("Failed to cleanup sessions:", error)
  }
}

// Rate limiting functions
function checkRateLimit(key: string, limit: typeof RATE_LIMITS[keyof typeof RATE_LIMITS]): boolean {
  const now = Date.now()
  const record = rateLimits.get(key)

  if (!record || now - record.windowStart > limit.windowMs) {
    // New window
    rateLimits.set(key, { attempts: 1, windowStart: now })
    return true
  }

  if (record.attempts >= limit.maxRequests) {
    return false
  }

  record.attempts++
  return true
}

// Security utility functions
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Audit logging
async function logSecurityEvent(event: {
  type: 'login_attempt' | 'otp_sent' | 'login_success' | 'login_failure'
  email?: string
  ip?: string
  userAgent?: string
  success: boolean
  details?: string
}): Promise<void> {
  try {
    const logFile = path.join(process.cwd(), "data", "security.log")
    await fs.mkdir(path.dirname(logFile), { recursive: true })

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event
    }

    await fs.appendFile(logFile, JSON.stringify(logEntry) + "\n")
  } catch (error) {
    console.error("Failed to log security event:", error)
  }
}

// Secure email configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // Add security settings
  tls: {
    rejectUnauthorized: true
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000
})

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendOTP(email: string): Promise<string | null> {
  try {
    // Input validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email address')
    }

    // Rate limiting
    const rateLimitKey = `otp_${email}`
    if (!checkRateLimit(rateLimitKey, RATE_LIMITS.otpRequests)) {
      throw new Error('Too many OTP requests. Please try again later.')
    }

    // Email domain validation
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || []
    if (allowedDomains.length > 0) {
      const domain = email.split('@')[1]
      if (!allowedDomains.includes(domain)) {
        throw new Error('Email domain not allowed')
      }
    }

    const otp = generateOTP()
    const sessionId = generateSecureToken()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    // Store OTP session securely
    const otpSessions = await loadOTPSessions()
    otpSessions.set(sessionId, {
      email: hashData(email.toLowerCase()), // Hash email for privacy
      otp: hashData(otp), // Hash OTP for security
      expiresAt,
      attempts: 0,
      sessionId,
      createdAt: Date.now()
    })

    await saveOTPSessions(otpSessions)

    // Send email with security headers
    await transporter.sendMail({
      from: {
        name: "AI Tweet Bot",
        address: process.env.GMAIL_EMAIL || ""
      },
      to: email,
      subject: "AI Tweet Bot - Giriş Kodu",
      headers: {
        'X-Priority': '1',
        'X-Mailer': 'AI Tweet Bot Secure',
        'List-Unsubscribe': `<mailto:${process.env.GMAIL_EMAIL}?subject=unsubscribe>`
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0;">AI Tweet Bot</h1>
            <p style="color: #6b7280; margin: 10px 0;">Güvenli Giriş Kodu</p>
          </div>

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; margin: 20px 0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: white; font-size: 36px; margin: 0; letter-spacing: 6px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${otp}</h1>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="color: #374151; margin: 0; font-weight: 500;">⏰ Bu kod <strong>5 dakika</strong> içinde geçerliliğini yitirecektir.</p>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 14px;">Kimseyle paylaşmayın!</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Bu e-postayı siz talep etmediyseniz, lütfen görmezden gelin.<br>
              IP: ${process.env.REMOTE_IP || 'unknown'} | Tarih: ${new Date().toLocaleString('tr-TR')}
            </p>
          </div>
        </div>
      `,
    })

    // Log security event
    await logSecurityEvent({
      type: 'otp_sent',
      email: hashData(email.toLowerCase()),
      success: true,
      details: `OTP sent to ${email.split('@')[0]}@***`
    })

    return sessionId
  } catch (error) {
    console.error("Failed to send OTP:", error)

    // Log security event
    await logSecurityEvent({
      type: 'otp_sent',
      email: email ? hashData(email.toLowerCase()) : 'unknown',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    })

    return null
  }
}

export async function verifyOTP(sessionId: string, otp: string, request?: Request): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
  try {
    // Input validation
    if (!sessionId || !otp) {
      return { success: false, error: 'Session ID and OTP are required' }
    }

    // Rate limiting
    const rateLimitKey = `verify_${request?.headers.get('x-forwarded-for') || 'unknown'}`
    if (!checkRateLimit(rateLimitKey, RATE_LIMITS.loginAttempts)) {
      return { success: false, error: 'Too many attempts. Please try again later.' }
    }

    const otpSessions = await loadOTPSessions()
    const session = otpSessions.get(sessionId)

    if (!session) {
      await logSecurityEvent({
        type: 'login_failure',
        success: false,
        details: 'Invalid session ID'
      })
      return { success: false, error: 'Invalid or expired session' }
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      otpSessions.delete(sessionId)
      await saveOTPSessions(otpSessions)

      await logSecurityEvent({
        type: 'login_failure',
        success: false,
        details: 'Expired OTP session'
      })
      return { success: false, error: 'OTP expired' }
    }

    // Check attempts limit
    if (session.attempts >= 3) {
      otpSessions.delete(sessionId)
      await saveOTPSessions(otpSessions)

      await logSecurityEvent({
        type: 'login_failure',
        success: false,
        details: 'Too many OTP attempts'
      })
      return { success: false, error: 'Too many attempts. Please request a new OTP.' }
    }

    // Increment attempts
    session.attempts++
    await saveOTPSessions(otpSessions)

    // Verify OTP (compare hashes)
    const hashedOTP = hashData(otp)
    if (session.otp === hashedOTP) {
      // Remove OTP session
      otpSessions.delete(sessionId)
      await saveOTPSessions(otpSessions)

      // Create authenticated session
      const sessions = await loadSessions()
      const sessionToken = generateSecureToken()
      const email = session.email // This is already hashed

      sessions.set(sessionToken, {
        sessionId: sessionToken,
        email,
        createdAt: Date.now(),
        lastAccess: Date.now()
      })

      await saveSessions(sessions)
      await cleanupExpiredSessions()

      // Log successful login
      await logSecurityEvent({
        type: 'login_success',
        email,
        ip: request?.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request?.headers.get('user-agent') || 'unknown',
        success: true
      })

      return { success: true, sessionToken }
    }

    // Log failed attempt
    await logSecurityEvent({
      type: 'login_failure',
      email: session.email,
      success: false,
      details: `Invalid OTP attempt ${session.attempts}/3`
    })

    return { success: false, error: 'Invalid OTP' }
  } catch (error) {
    console.error('OTP verification error:', error)

    await logSecurityEvent({
      type: 'login_failure',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    })

    return { success: false, error: 'Verification failed' }
  }
}

export async function checkAuth(request: Request): Promise<{ authenticated: boolean; email?: string; sessionToken?: string }> {
  try {
    const cookie = request.headers.get("cookie")
    if (!cookie) {
      return { authenticated: false }
    }

    // Parse cookies securely
    const cookies = Object.fromEntries(
      cookie.split(';').map(cookie => {
        const [key, value] = cookie.trim().split('=')
        return [key, value]
      })
    )

    const sessionToken = cookies['session_token']
    if (!sessionToken) {
      return { authenticated: false }
    }

    // Validate session token format
    if (!/^[a-f0-9]{64}$/.test(sessionToken)) {
      return { authenticated: false }
    }

    // Check session in secure storage
    const sessions = await loadSessions()
    const session = sessions.get(sessionToken)

    if (!session) {
      return { authenticated: false }
    }

    // Check session expiration (24 hours)
    if (Date.now() - session.lastAccess > 24 * 60 * 60 * 1000) {
      sessions.delete(sessionToken)
      await saveSessions(sessions)
      return { authenticated: false }
    }

    // Update last access time
    session.lastAccess = Date.now()
    await saveSessions(sessions)

    return {
      authenticated: true,
      email: session.email,
      sessionToken
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return { authenticated: false }
  }
}

export async function requireAuth(request: Request): Promise<Response> {
  const auth = await checkAuth(request)
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
        "Cache-Control": "no-store",
        "Pragma": "no-cache"
      },
    })
  }
  return new Response(JSON.stringify({ authenticated: true, email: auth.email }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export async function createAuthSession(sessionToken: string, email: string): Promise<void> {
  try {
    const sessions = await loadSessions()
    sessions.set(sessionToken, {
      sessionId: sessionToken,
      email: hashData(email.toLowerCase()),
      createdAt: Date.now(),
      lastAccess: Date.now()
    })

    await saveSessions(sessions)
  } catch (error) {
    console.error('Failed to create auth session:', error)
    throw error
  }
}

export async function destroyAuthSession(sessionToken: string): Promise<void> {
  try {
    const sessions = await loadSessions()
    sessions.delete(sessionToken)
    await saveSessions(sessions)
  } catch (error) {
    console.error('Failed to destroy auth session:', error)
    throw error
  }
}

export async function isValidAdminEmail(email: string): Promise<boolean> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      return false
    }

    // Normalize emails for comparison
    const normalizedInput = email.toLowerCase().trim()
    const normalizedAdmin = adminEmail.toLowerCase().trim()

    return normalizedInput === normalizedAdmin
  } catch (error) {
    console.error('Admin email validation error:', error)
    return false
  }
}

// Security utilities
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[\"\']/g, '') // Remove quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

// Initialize cleanup on startup
if (typeof window === 'undefined') {
  // Server-side only
  setTimeout(cleanupExpiredSessions, 5000) // Cleanup after 5 seconds
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000) // Cleanup every hour
}
