import fs from 'fs/promises'
import path from 'path'
import { generateSecureToken } from './security-utils'

// Audit event types
export type AuditEventType =
  | 'login_attempt' | 'login_success' | 'login_failure'
  | 'logout' | 'session_expired' | 'session_created' | 'session_destroyed'
  | 'otp_sent' | 'otp_verified' | 'otp_failed'
  | 'api_access' | 'api_error' | 'api_rate_limit'
  | 'tweet_created' | 'tweet_posted' | 'tweet_failed' | 'tweet_deleted'
  | 'file_uploaded' | 'file_downloaded' | 'file_deleted'
  | 'settings_changed' | 'admin_action'
  | 'security_alert' | 'suspicious_activity'
  | 'data_export' | 'data_import' | 'data_backup' | 'data_restore'
  | 'key_rotation' | 'key_created' | 'key_deleted' | 'key_access'
  | 'permission_changed' | 'role_changed'
  | 'system_error' | 'system_start' | 'system_shutdown'

export interface AuditEvent {
  id: string
  timestamp: string
  eventType: AuditEventType
  userId?: string
  userEmail?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  action?: string
  details?: Record<string, any>
  success: boolean
  error?: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  category: 'auth' | 'api' | 'data' | 'security' | 'system'
  metadata?: Record<string, any>
}

interface AuditLogConfig {
  enabled: boolean
  logToFile: boolean
  logToConsole: boolean
  retentionDays: number
  filePath: string
  maxFileSize: number // in bytes
  maxFiles: number
  includePII: boolean // Personally Identifiable Information
  sensitiveFields: string[]
}

class AuditLogger {
  private config: AuditLogConfig
  private buffer: AuditEvent[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private isFlushing = false

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      logToFile: config.logToFile ?? true,
      logToConsole: config.logToConsole ?? false,
      retentionDays: config.retentionDays ?? 30,
      filePath: config.filePath ?? path.join(process.cwd(), 'data', 'audit.log'),
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles ?? 5,
      includePII: config.includePII ?? false,
      sensitiveFields: config.sensitiveFields ?? [
        'password', 'otp', 'token', 'key', 'secret', 'authorization',
        'cookie', 'session', 'credit_card', 'ssn', 'social_security'
      ]
    }

    // Start periodic flush
    this.startFlushInterval()

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown())
    process.on('SIGINT', () => this.shutdown())
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error)
    }, 5000) // Flush every 5 seconds
  }

  private async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sanitized: any = {}

    for (const [key, value] of Object.entries(data)) {
      if (this.config.sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private createEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    return {
      id: generateSecureToken(16),
      timestamp: new Date().toISOString(),
      ...event,
      details: event.details ? this.sanitizeData(event.details) : undefined,
      metadata: event.metadata ? this.sanitizeData(event.metadata) : undefined
    }
  }

  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    if (!this.config.enabled) {
      return
    }

    const auditEvent = this.createEvent(event)
    this.buffer.push(auditEvent)

    // Flush immediately for critical events
    if (event.severity === 'critical') {
      this.flush().catch(console.error)
    }

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(auditEvent)
    }
  }

  private logToConsole(event: AuditEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleString()
    const level = event.severity.toUpperCase()
    const message = `[${timestamp}] [${level}] [${event.category}] ${event.eventType}`

    switch (event.severity) {
      case 'critical':
      case 'error':
        console.error(message, event)
        break
      case 'warning':
        console.warn(message, event)
        break
      default:
        console.log(message, event)
    }
  }

  private async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return
    }

    this.isFlushing = true
    const eventsToFlush = [...this.buffer]
    this.buffer = []

    try {
      if (this.config.logToFile) {
        await this.writeToFile(eventsToFlush)
      }
    } catch (error) {
      console.error('Failed to flush audit logs:', error)
      // Re-add events to buffer on failure
      this.buffer.unshift(...eventsToFlush)
    } finally {
      this.isFlushing = false
    }
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    try {
      const dir = path.dirname(this.config.filePath)
      await fs.mkdir(dir, { recursive: true })

      // Check file size and rotate if needed
      await this.rotateIfNeeded()

      // Write events to file
      const logLines = events.map(event => JSON.stringify(event)).join('\\n')
      await fs.appendFile(this.config.filePath, logLines + '\\n')

    } catch (error) {
      console.error('Failed to write audit log:', error)
      throw error
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.config.filePath)

      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFile()
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to check log file size:', error)
      }
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const rotatedPath = `${this.config.filePath}.${timestamp}`

      // Rename current file
      await fs.rename(this.config.filePath, rotatedPath)

      // Clean up old log files
      await this.cleanupOldLogs()

    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const dir = path.dirname(this.config.filePath)
      const files = await fs.readdir(dir)

      const logFiles = files
        .filter(file => file.startsWith(path.basename(this.config.filePath)))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          stat: fs.stat(path.join(dir, file))
        }))

      // Sort by modification time (oldest first)
      const sortedFiles = await Promise.all(
        logFiles.map(async (file) => ({
          ...file,
          mtime: (await file.stat).mtime
        }))
      ).then(files => files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime()))

      // Remove old files, keeping the most recent ones
      const filesToDelete = sortedFiles.slice(0, -this.config.maxFiles)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      for (const file of filesToDelete) {
        if (file.mtime < cutoffDate && file.name !== path.basename(this.config.filePath)) {
          await fs.unlink(file.path)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  async query(filters?: {
    eventType?: AuditEventType[]
    userId?: string
    startDate?: Date
    endDate?: Date
    severity?: AuditEvent['severity'][]
    category?: AuditEvent['category'][]
    success?: boolean
    limit?: number
  }): Promise<AuditEvent[]> {
    try {
      const events: AuditEvent[] = []

      // Read all log files
      const dir = path.dirname(this.config.filePath)
      const files = await fs.readdir(dir)

      const logFiles = files.filter(file =>
        file.startsWith(path.basename(this.config.filePath))
      )

      for (const file of logFiles) {
        const filePath = path.join(dir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const event = JSON.parse(line)
            events.push(event)
          } catch (error) {
            console.error('Failed to parse audit log line:', error)
          }
        }
      }

      // Apply filters
      let filteredEvents = events

      if (filters?.eventType) {
        filteredEvents = filteredEvents.filter(e =>
          filters.eventType!.includes(e.eventType)
        )
      }

      if (filters?.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === filters.userId)
      }

      if (filters?.startDate) {
        filteredEvents = filteredEvents.filter(e =>
          new Date(e.timestamp) >= filters.startDate!
        )
      }

      if (filters?.endDate) {
        filteredEvents = filteredEvents.filter(e =>
          new Date(e.timestamp) <= filters.endDate!
        )
      }

      if (filters?.severity) {
        filteredEvents = filteredEvents.filter(e =>
          filters.severity!.includes(e.severity)
        )
      }

      if (filters?.category) {
        filteredEvents = filteredEvents.filter(e =>
          filters.category!.includes(e.category)
        )
      }

      if (filters?.success !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.success === filters.success)
      }

      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      // Apply limit
      if (filters?.limit) {
        filteredEvents = filteredEvents.slice(0, filters.limit)
      }

      return filteredEvents

    } catch (error) {
      console.error('Failed to query audit logs:', error)
      throw error
    }
  }

  async getStats(): Promise<{
    totalEvents: number
    eventsByType: Record<AuditEventType, number>
    eventsBySeverity: Record<AuditEvent['severity'], number>
    eventsByCategory: Record<AuditEvent['category'], number>
    recentEvents: AuditEvent[]
  }> {
    try {
      const recentEvents = await this.query({ limit: 100 })
      const allEvents = await this.query({})

      const eventsByType: Record<AuditEventType, number> = {} as any
      const eventsBySeverity: Record<AuditEvent['severity'], number> = {} as any
      const eventsByCategory: Record<AuditEvent['category'], number> = {} as any

      for (const event of allEvents) {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
        eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1
      }

      return {
        totalEvents: allEvents.length,
        eventsByType,
        eventsBySeverity,
        eventsByCategory,
        recentEvents
      }
    } catch (error) {
      console.error('Failed to get audit stats:', error)
      throw error
    }
  }

  async export(startDate: Date, endDate: Date, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const events = await this.query({
        startDate,
        endDate,
        limit: 10000
      })

      if (format === 'json') {
        return JSON.stringify(events, null, 2)
      } else if (format === 'csv') {
        // Convert to CSV
        const headers = [
          'timestamp', 'eventType', 'userId', 'userEmail', 'ipAddress',
          'resource', 'action', 'success', 'severity', 'category', 'error'
        ]

        const rows = events.map(event => [
          event.timestamp,
          event.eventType,
          event.userId || '',
          event.userEmail || '',
          event.ipAddress || '',
          event.resource || '',
          event.action || '',
          event.success.toString(),
          event.severity,
          event.category,
          event.error || ''
        ])

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\\n')
      } else {
        throw new Error('Unsupported export format')
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      throw error
    }
  }
}

// Create default instance
export const auditLogger = new AuditLogger()

// Helper functions for common audit events
export function logAuthEvent(
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'session_expired',
  success: boolean,
  request: Request,
  details?: Record<string, any>
): void {
  auditLogger.log({
    eventType: type,
    category: 'auth',
    success,
    severity: success ? 'info' : 'warning',
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details
  })
}

export function logAPIEvent(
  action: string,
  success: boolean,
  request: Request,
  details?: Record<string, any>
): void {
  auditLogger.log({
    eventType: success ? 'api_access' : 'api_error',
    category: 'api',
    success,
    severity: success ? 'info' : 'warning',
    resource: new URL(request.url).pathname,
    action,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details
  })
}

export function logSecurityEvent(
  type: 'security_alert' | 'suspicious_activity',
  severity: 'warning' | 'error' | 'critical',
  request: Request,
  details?: Record<string, any>
): void {
  auditLogger.log({
    eventType: type,
    category: 'security',
    success: false,
    severity,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details
  })
}

export function logTweetEvent(
  type: 'tweet_created' | 'tweet_posted' | 'tweet_failed' | 'tweet_deleted',
  success: boolean,
  request: Request,
  details?: Record<string, any>
): void {
  auditLogger.log({
    eventType: type,
    category: 'data',
    success,
    severity: success ? 'info' : 'error',
    action: type,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details
  })
}