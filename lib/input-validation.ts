import { validateAndSanitize } from './security-utils'

// Common validation patterns
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
  tweetContent: /^[\w\s\p{P}\p{S}]+$/u,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  hex: /^[a-fA-F0-9]+$/,
  numeric: /^\d+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  zipcode: /^\d{5}(-\d{4})?$/
}

// Length constraints
const CONSTRAINTS = {
  tweet: { min: 1, max: 280 },
  username: { min: 3, max: 20 },
  email: { min: 5, max: 254 },
  url: { min: 1, max: 2048 },
  apiKey: { min: 16, max: 100 },
  sessionId: { min: 32, max: 64 },
  otp: { min: 6, max: 6 }
}

// Content validation
export function validateTweetContent(content: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = content.trim()

  // Length validation
  if (sanitized.length < CONSTRAINTS.tweet.min) {
    errors.push('Tweet content cannot be empty')
  }

  if (sanitized.length > CONSTRAINTS.tweet.max) {
    errors.push(`Tweet content exceeds maximum length of ${CONSTRAINTS.tweet.max} characters`)
  }

  // Content validation
  if (!PATTERNS.tweetContent.test(sanitized)) {
    errors.push('Tweet content contains invalid characters')
  }

  // Security validation
  const securityIssues = validateSecurityContent(sanitized)
  errors.push(...securityIssues)

  // Sanitize content
  sanitized = sanitizeTweetContent(sanitized)

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateSecurityContent(content: string): string[] {
  const issues: string[] = []

  // Check for potential XSS
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /data:text\/html/gi
  ]

  for (const pattern of xssPatterns) {
    if (pattern.test(content)) {
      issues.push('Content contains potentially malicious scripts')
      break
    }
  }

  // Check for SQL injection patterns
  const sqlPatterns = [
    /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)(\s|$)/gi,
    /(\s|^)(UNION\s+ALL|UNION\s+SELECT)(\s|$)/gi,
    /(\s|^)(OR\s+1\s*=\s*1|OR\s+TRUE)(\s|$)/gi,
    /(\s|^)(AND\s+1\s*=\s*1|AND\s+TRUE)(\s|$)/gi,
    /(\s|^)(--|\/\*|\*\/)(\s|$)/gi
  ]

  for (const pattern of sqlPatterns) {
    if (pattern.test(content)) {
      issues.push('Content contains potential SQL injection patterns')
      break
    }
  }

  // Check for command injection
  const cmdPatterns = [
    /[;&|`$(){}[\]]/,
    /\/bin\/(sh|bash|zsh)/,
    /cmd\.exe/,
    /powershell/,
    /\$\([^)]*\)/,
    /`[^`]*`/
  ]

  for (const pattern of cmdPatterns) {
    if (pattern.test(content)) {
      issues.push('Content contains potential command injection patterns')
      break
    }
  }

  // Check for sensitive data patterns
  const sensitivePatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{10,}\b/, // Phone numbers
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/ // IP addresses
  ]

  for (const pattern of sensitivePatterns) {
    if (pattern.test(content)) {
      issues.push('Content may contain sensitive information')
      break
    }
  }

  return issues
}

export function sanitizeTweetContent(content: string): string {
  let sanitized = content

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // Remove potentially dangerous attributes
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:\s*[^\s]*/gi, '')

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ')

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '')

  // Remove extra quotes
  sanitized = sanitized.replace(/["']/g, '')

  return sanitized.trim()
}

export function validateEmail(email: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = email.trim().toLowerCase()

  // Format validation
  if (!PATTERNS.email.test(sanitized)) {
    errors.push('Invalid email format')
  }

  // Length validation
  if (sanitized.length < CONSTRAINTS.email.min) {
    errors.push('Email address too short')
  }

  if (sanitized.length > CONSTRAINTS.email.max) {
    errors.push('Email address too long')
  }

  // Domain validation
  const domain = sanitized.split('@')[1]
  if (domain) {
    // Check for disposable email domains (optional)
    const disposableDomains = [
      '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'tempmail.com', 'throwawaymail.com', 'yopmail.com'
    ]

    if (disposableDomains.includes(domain)) {
      errors.push('Disposable email addresses are not allowed')
    }

    // Check domain MX record (simplified)
    if (!domain.includes('.')) {
      errors.push('Invalid email domain')
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateUrl(url: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = url.trim()

  // Protocol validation
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    errors.push('URL must use http:// or https:// protocol')
  }

  // Format validation
  if (!PATTERNS.url.test(sanitized)) {
    errors.push('Invalid URL format')
  }

  // Length validation
  if (sanitized.length < CONSTRAINTS.url.min) {
    errors.push('URL too short')
  }

  if (sanitized.length > CONSTRAINTS.url.max) {
    errors.push('URL too long')
  }

  // Security validation
  try {
    const urlObj = new URL(sanitized)

    // Check for localhost/internal IPs
    const hostname = urlObj.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      errors.push('URL cannot point to internal addresses')
    }

    // Check for dangerous protocols
    if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
      errors.push('URL cannot use dangerous protocols')
    }

    // Check for port specification
    if (urlObj.port && parseInt(urlObj.port) < 80) {
      errors.push('URL cannot use privileged ports')
    }

  } catch (error) {
    errors.push('Invalid URL format')
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateUsername(username: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = username.trim()

  // Length validation
  if (sanitized.length < CONSTRAINTS.username.min) {
    errors.push('Username too short')
  }

  if (sanitized.length > CONSTRAINTS.username.max) {
    errors.push('Username too long')
  }

  // Format validation
  if (!PATTERNS.username.test(sanitized)) {
    errors.push('Username can only contain letters, numbers, and underscores')
  }

  // Reserved usernames
  const reservedNames = [
    'admin', 'administrator', 'root', 'system', 'support',
    'info', 'noreply', 'security', 'auth', 'login', 'api'
  ]

  if (reservedNames.includes(sanitized.toLowerCase())) {
    errors.push('Username is reserved')
  }

  // No consecutive underscores
  if (sanitized.includes('__')) {
    errors.push('Username cannot contain consecutive underscores')
  }

  // Cannot start or end with underscore
  if (sanitized.startsWith('_') || sanitized.endsWith('_')) {
    errors.push('Username cannot start or end with underscore')
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateApiKey(apiKey: string, type: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = apiKey.trim()

  // Length validation
  if (sanitized.length < CONSTRAINTS.apiKey.min) {
    errors.push('API key too short')
  }

  if (sanitized.length > CONSTRAINTS.apiKey.max) {
    errors.push('API key too long')
  }

  // Type-specific validation
  switch (type) {
    case 'twitter':
      if (!sanitized.match(/^[a-zA-Z0-9]{10,50}$/)) {
        errors.push('Invalid Twitter API key format')
      }
      break

    case 'github':
      if (!sanitized.startsWith('ghp_') && !sanitized.startsWith('github_pat_')) {
        errors.push('Invalid GitHub token format')
      }
      break

    case 'google':
    case 'openai':
    case 'gemini':
      if (!sanitized.match(/^[a-zA-Z0-9\-_]{20,100}$/)) {
        errors.push('Invalid API key format')
      }
      break
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateOTP(otp: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = otp.trim()

  // Length validation
  if (sanitized.length !== CONSTRAINTS.otp.min) {
    errors.push('OTP must be 6 digits')
  }

  // Format validation
  if (!PATTERNS.numeric.test(sanitized)) {
    errors.push('OTP must contain only numbers')
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

export function validateSessionId(sessionId: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  let sanitized = sessionId.trim()

  // Length validation
  if (sanitized.length < CONSTRAINTS.sessionId.min) {
    errors.push('Session ID too short')
  }

  if (sanitized.length > CONSTRAINTS.sessionId.max) {
    errors.push('Session ID too long')
  }

  // Format validation
  if (!PATTERNS.hex.test(sanitized)) {
    errors.push('Session ID must be hexadecimal')
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

// General input validation wrapper
export function validateInput(
  input: string,
  type: 'email' | 'url' | 'username' | 'tweet' | 'apiKey' | 'otp' | 'sessionId',
  options?: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    customValidation?: (value: string) => string[]
  }
): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = []

  // Required check
  if (options?.required && !input.trim()) {
    errors.push('This field is required')
    return { valid: false, sanitized: '', errors }
  }

  let sanitized = input.trim()

  // Type-specific validation
  switch (type) {
    case 'email':
      return validateEmail(sanitized)
    case 'url':
      return validateUrl(sanitized)
    case 'username':
      return validateUsername(sanitized)
    case 'tweet':
      return validateTweetContent(sanitized)
    case 'apiKey':
      return validateApiKey(sanitized, options?.customValidation?.toString() || 'general')
    case 'otp':
      return validateOTP(sanitized)
    case 'sessionId':
      return validateSessionId(sanitized)
    default:
      // Generic validation
      if (options?.minLength && sanitized.length < options.minLength) {
        errors.push(`Minimum length is ${options.minLength}`)
      }

      if (options?.maxLength && sanitized.length > options.maxLength) {
        errors.push(`Maximum length is ${options.maxLength}`)
      }

      if (options?.pattern && !options.pattern.test(sanitized)) {
        errors.push('Invalid format')
      }

      if (options?.customValidation) {
        const customErrors = options.customValidation(sanitized)
        errors.push(...customErrors)
      }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  }
}

// Batch validation
export function validateMultipleInputs(
  inputs: Record<string, { value: string; type: string; options?: any }>
): Record<string, { valid: boolean; sanitized: string; errors: string[] }> {
  const results: Record<string, { valid: boolean; sanitized: string; errors: string[] }> = {}

  for (const [key, input] of Object.entries(inputs)) {
    results[key] = validateInput(input.value, input.type as any, input.options)
  }

  return results
}

// Content moderation
export function moderateContent(content: string): {
  isAppropriate: boolean
  issues: string[]
  severity: 'low' | 'medium' | 'high'
  sanitized: string
} {
  const issues: string[] = []
  let severity: 'low' | 'medium' | 'high' = 'low'

  // Profanity detection (simplified)
  const profanityPatterns = [
    /\b(fuck|shit|ass|bitch|damn|hell|crap|piss)\b/gi,
    /\b(damn|hell|crap|piss)\b/gi
  ]

  for (const pattern of profanityPatterns) {
    if (pattern.test(content)) {
      issues.push('Contains inappropriate language')
      severity = 'medium'
      break
    }
  }

  // Hate speech detection (simplified)
  const hateSpeechPatterns = [
    /\b(racist|sexist|homophobic|xenophobic)\b/gi,
    /\b(hate|kill|violence|attack)\b/gi
  ]

  for (const pattern of hateSpeechPatterns) {
    if (pattern.test(content)) {
      issues.push('Contains potentially harmful content')
      severity = 'high'
      break
    }
  }

  // Spam detection
  const spamPatterns = [
    /(http|https):\/\/[^\s]+/gi, // Too many links
    /\b(free|win|prize|offer|deal)\b/gi, // Spam keywords
    /([A-Z])\1{2,}/g // Excessive capitalization
  ]

  let spamScore = 0
  for (const pattern of spamPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      spamScore += matches.length
    }
  }

  if (spamScore > 3) {
    issues.push('May be spam content')
    severity = Math.max(severity, 'medium')
  }

  // Sanitize content
  const sanitized = sanitizeTweetContent(content)

  return {
    isAppropriate: issues.length === 0,
    issues,
    severity,
    sanitized
  }
}