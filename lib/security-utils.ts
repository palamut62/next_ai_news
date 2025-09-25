import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Generate a secure encryption key if not provided
function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(64, '0').substring(0, 64)
  return Buffer.from(key, 'hex')
}

// Encrypt sensitive data
export function encryptData(data: string): { encrypted: string; iv: string; tag: string } {
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipher(ALGORITHM, getEncryptionKey())

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

// Decrypt sensitive data
export function decryptData(encrypted: string, iv: string, tag: string): string {
  try {
    const decipher = crypto.createDecipher(ALGORITHM, getEncryptionKey())
    decipher.setAuthTag(Buffer.from(tag, 'hex'))

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

// Hash sensitive data for comparison
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

// Validate and sanitize file paths
export function sanitizeFilePath(filePath: string): string {
  // Remove directory traversal attempts
  const sanitized = filePath
    .replace(/\.\./g, '')
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/\\/g, '_')

  // Only allow safe characters
  return sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_')
}

// Secure file operations with encryption
export async function writeSecureFile(
  filePath: string,
  data: any,
  encrypt: boolean = true
): Promise<void> {
  try {
    const safePath = sanitizeFilePath(filePath)
    const fullPath = path.join(process.cwd(), 'data', safePath)

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    let content: string

    if (encrypt) {
      const stringData = typeof data === 'string' ? data : JSON.stringify(data)
      const encrypted = encryptData(stringData)
      content = JSON.stringify({
        encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        timestamp: Date.now(),
        version: '1.0'
      })
    } else {
      content = typeof data === 'string' ? data : JSON.stringify(data)
    }

    await fs.writeFile(fullPath, content, 'utf-8')

    // Set secure file permissions (if supported)
    try {
      await fs.chmod(fullPath, 0o600) // Read/write for owner only
    } catch (error) {
      // Ignore permission errors on Windows
      console.warn('Could not set file permissions:', error)
    }
  } catch (error) {
    console.error('Secure file write error:', error)
    throw new Error('Failed to write secure file')
  }
}

export async function readSecureFile(
  filePath: string,
  decrypt: boolean = true
): Promise<any> {
  try {
    const safePath = sanitizeFilePath(filePath)
    const fullPath = path.join(process.cwd(), 'data', safePath)

    const content = await fs.readFile(fullPath, 'utf-8')

    if (!decrypt) {
      return content
    }

    const parsed = JSON.parse(content)

    if (parsed.encrypted && parsed.iv && parsed.tag) {
      return decryptData(parsed.encrypted, parsed.iv, parsed.tag)
    }

    return parsed
  } catch (error) {
    console.error('Secure file read error:', error)
    throw new Error('Failed to read secure file')
  }
}

// Secure environment variable handling
export function getSecureEnv(key: string, required: boolean = true): string {
  const value = process.env[key]

  if (!value && required) {
    throw new Error(`Required environment variable ${key} is not set`)
  }

  if (!value) {
    return ''
  }

  // Validate common secret formats
  if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
    if (value.length < 16) {
      console.warn(`Environment variable ${key} appears to be too short`)
    }
  }

  return value
}

// Input validation and sanitization
export function validateAndSanitize(input: string, type: 'email' | 'text' | 'url' | 'number'): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input')
  }

  let sanitized = input.trim()

  switch (type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        throw new Error('Invalid email format')
      }
      return sanitized.toLowerCase()

    case 'url':
      try {
        new URL(sanitized)
        return sanitized
      } catch {
        throw new Error('Invalid URL format')
      }

    case 'number':
      if (!/^\d+$/.test(sanitized)) {
        throw new Error('Invalid number format')
      }
      return sanitized

    case 'text':
    default:
      // Remove potentially dangerous characters
      sanitized = sanitized
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/["']/g, '') // Remove quotes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
      return sanitized
  }
}

// Security headers for HTTP responses
export const securityHeaders = {
  'Content-Security-Policy': \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none';\",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}

// Rate limiting utilities
interface RateLimitRecord {
  attempts: number
  windowStart: number
  blocked: boolean
}

const rateLimitStore = new Map<string, RateLimitRecord>()

export function checkRateLimitAdvanced(
  key: string,
  windowMs: number = 60000, // 1 minute
  maxAttempts: number = 10
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now - record.windowStart > windowMs) {
    // New window
    const newRecord: RateLimitRecord = {
      attempts: 1,
      windowStart: now,
      blocked: false
    }
    rateLimitStore.set(key, newRecord)

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetTime: now + windowMs
    }
  }

  if (record.blocked) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.windowStart + windowMs
    }
  }

  if (record.attempts >= maxAttempts) {
    // Block for the rest of the window
    record.blocked = true
    rateLimitStore.set(key, record)

    return {
      allowed: false,
      remaining: 0,
      resetTime: record.windowStart + windowMs
    }
  }

  // Increment attempts
  record.attempts++
  rateLimitStore.set(key, record)

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts,
    resetTime: record.windowStart + windowMs
  }
}

// Clean up expired rate limit records
export function cleanupRateLimits(): void {
  const now = Date.now()
  const windowMs = 60000 // 1 minute

  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > windowMs) {
      rateLimitStore.delete(key)
    }
  }
}

// Initialize cleanup
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000) // Cleanup every 5 minutes
}