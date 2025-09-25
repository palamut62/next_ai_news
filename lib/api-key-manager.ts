import { encryptData, decryptData, generateSecureToken, getSecureEnv } from './security-utils'
import fs from 'fs/promises'
import path from 'path'

interface APIKey {
  id: string
  name: string
  encryptedKey: string
  iv: string
  tag: string
  type: 'twitter' | 'github' | 'google' | 'openai' | 'gemini' | 'email'
  environment: 'development' | 'production'
  createdAt: string
  lastUsed?: string
  expiresAt?: string
  rotationRequired: boolean
  accessCount: number
}

interface APIKeyUsage {
  keyId: string
  timestamp: string
  endpoint: string
  success: boolean
  error?: string
}

class APIKeyManager {
  private readonly KEYS_FILE = path.join(process.cwd(), 'data', 'api-keys.json')
  private readonly USAGE_FILE = path.join(process.cwd(), 'data', 'api-key-usage.json')
  private keysCache: Map<string, APIKey> = new Map()
  private lastCacheUpdate = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  async loadKeys(): Promise<Map<string, APIKey>> {
    try {
      // Use cache if still valid
      if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL && this.keysCache.size > 0) {
        return this.keysCache
      }

      await fs.mkdir(path.dirname(this.KEYS_FILE), { recursive: true })
      const data = await fs.readFile(this.KEYS_FILE, 'utf-8')
      const keys: APIKey[] = JSON.parse(data)

      this.keysCache = new Map(keys.map(key => [key.id, key]))
      this.lastCacheUpdate = Date.now()

      return this.keysCache
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return new Map()
      }
      throw error
    }
  }

  async saveKeys(keys: Map<string, APIKey>): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.KEYS_FILE), { recursive: true })
      const data = Array.from(keys.values())
      await fs.writeFile(this.KEYS_FILE, JSON.stringify(data, null, 2))

      // Update cache
      this.keysCache = keys
      this.lastCacheUpdate = Date.now()
    } catch (error) {
      console.error('Failed to save API keys:', error)
      throw error
    }
  }

  async createKey(
    name: string,
    keyValue: string,
    type: APIKey['type'],
    environment: APIKey['environment'] = 'development'
  ): Promise<APIKey> {
    try {
      // Validate key format based on type
      this.validateKeyFormat(keyValue, type)

      const encrypted = encryptData(keyValue)
      const key: APIKey = {
        id: generateSecureToken(16),
        name,
        encryptedKey: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        type,
        environment,
        createdAt: new Date().toISOString(),
        rotationRequired: false,
        accessCount: 0
      }

      const keys = await this.loadKeys()
      keys.set(key.id, key)
      await this.saveKeys(keys)

      // Log key creation
      await this.logKeyUsage({
        keyId: key.id,
        timestamp: new Date().toISOString(),
        endpoint: 'create_key',
        success: true
      })

      return key
    } catch (error) {
      console.error('Failed to create API key:', error)
      throw new Error('Failed to create API key')
    }
  }

  async getKey(keyId: string): Promise<string | null> {
    try {
      const keys = await this.loadKeys()
      const key = keys.get(keyId)

      if (!key) {
        return null
      }

      // Check if key is expired
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        throw new Error('API key has expired')
      }

      // Update usage statistics
      key.accessCount++
      key.lastUsed = new Date().toISOString()
      await this.saveKeys(keys)

      // Log key access
      await this.logKeyUsage({
        keyId: key.id,
        timestamp: new Date().toISOString(),
        endpoint: 'get_key',
        success: true
      })

      return decryptData(key.encryptedKey, key.iv, key.tag)
    } catch (error) {
      console.error('Failed to get API key:', error)
      await this.logKeyUsage({
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: 'get_key',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async rotateKey(keyId: string, newKeyValue: string): Promise<APIKey> {
    try {
      const keys = await this.loadKeys()
      const key = keys.get(keyId)

      if (!key) {
        throw new Error('API key not found')
      }

      // Validate new key format
      this.validateKeyFormat(newKeyValue, key.type)

      const encrypted = encryptData(newKeyValue)
      const updatedKey: APIKey = {
        ...key,
        encryptedKey: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        rotationRequired: false,
        lastUsed: new Date().toISOString()
      }

      keys.set(keyId, updatedKey)
      await this.saveKeys(keys)

      // Log key rotation
      await this.logKeyUsage({
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: 'rotate_key',
        success: true
      })

      return updatedKey
    } catch (error) {
      console.error('Failed to rotate API key:', error)
      throw new Error('Failed to rotate API key')
    }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    try {
      const keys = await this.loadKeys()
      const deleted = keys.delete(keyId)

      if (deleted) {
        await this.saveKeys(keys)

        // Log key deletion
        await this.logKeyUsage({
          keyId,
          timestamp: new Date().toISOString(),
          endpoint: 'delete_key',
          success: true
        })
      }

      return deleted
    } catch (error) {
      console.error('Failed to delete API key:', error)
      throw new Error('Failed to delete API key')
    }
  }

  async listKeys(type?: APIKey['type'], environment?: APIKey['environment']): Promise<APIKey[]> {
    try {
      const keys = await this.loadKeys()
      const filteredKeys = Array.from(keys.values()).filter(key => {
        if (type && key.type !== type) return false
        if (environment && key.environment !== environment) return false
        return true
      })

      return filteredKeys.map(key => ({
        ...key,
        encryptedKey: '[REDACTED]',
        iv: '[REDACTED]',
        tag: '[REDACTED]'
      }))
    } catch (error) {
      console.error('Failed to list API keys:', error)
      throw new Error('Failed to list API keys')
    }
  }

  async markForRotation(keyId: string): Promise<void> {
    try {
      const keys = await this.loadKeys()
      const key = keys.get(keyId)

      if (key) {
        key.rotationRequired = true
        await this.saveKeys(keys)

        // Log rotation requirement
        await this.logKeyUsage({
          keyId,
          timestamp: new Date().toISOString(),
          endpoint: 'mark_rotation',
          success: true
        })
      }
    } catch (error) {
      console.error('Failed to mark API key for rotation:', error)
      throw new Error('Failed to mark API key for rotation')
    }
  }

  async checkKeyHealth(): Promise<{
    total: number
    expired: number
    rotationRequired: number
    highUsage: number
  }> {
    try {
      const keys = await this.loadKeys()
      const now = new Date()

      let expired = 0
      let rotationRequired = 0
      let highUsage = 0

      for (const key of keys.values()) {
        if (key.expiresAt && new Date(key.expiresAt) < now) {
          expired++
        }
        if (key.rotationRequired) {
          rotationRequired++
        }
        if (key.accessCount > 10000) {
          highUsage++
        }
      }

      return {
        total: keys.size,
        expired,
        rotationRequired,
        highUsage
      }
    } catch (error) {
      console.error('Failed to check API key health:', error)
      throw new Error('Failed to check API key health')
    }
  }

  private validateKeyFormat(key: string, type: APIKey['type']): void {
    switch (type) {
      case 'twitter':
        if (!key.match(/^[a-zA-Z0-9]{10,50}$/)) {
          throw new Error('Invalid Twitter API key format')
        }
        break
      case 'github':
        if (!key.startsWith('ghp_') && !key.startsWith('github_pat_')) {
          throw new Error('Invalid GitHub token format')
        }
        break
      case 'google':
      case 'openai':
      case 'gemini':
        if (key.length < 20 || key.length > 100) {
          throw new Error('Invalid API key length')
        }
        break
      case 'email':
        if (!key.match(/^[a-zA-Z0-9\-]{16,20}$/)) {
          throw new Error('Invalid email app password format')
        }
        break
    }
  }

  private async logKeyUsage(usage: APIKeyUsage): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.USAGE_FILE), { recursive: true })

      let usages: APIKeyUsage[] = []
      try {
        const data = await fs.readFile(this.USAGE_FILE, 'utf-8')
        usages = JSON.parse(data)
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          throw error
        }
      }

      usages.push(usage)

      // Keep only last 1000 entries
      if (usages.length > 1000) {
        usages = usages.slice(-1000)
      }

      await fs.writeFile(this.USAGE_FILE, JSON.stringify(usages, null, 2))
    } catch (error) {
      console.error('Failed to log API key usage:', error)
      // Don't throw for logging errors
    }
  }

  async getUsageStats(keyId?: string): Promise<{
    totalUses: number
    successRate: number
    lastUsed?: string
    popularEndpoints: Array<{ endpoint: string; count: number }>
  }> {
    try {
      await fs.mkdir(path.dirname(this.USAGE_FILE), { recursive: true })

      let usages: APIKeyUsage[] = []
      try {
        const data = await fs.readFile(this.USAGE_FILE, 'utf-8')
        usages = JSON.parse(data)
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          throw error
        }
      }

      let filteredUsages = usages
      if (keyId) {
        filteredUsages = usages.filter(u => u.keyId === keyId)
      }

      const totalUses = filteredUsages.length
      const successfulUses = filteredUsages.filter(u => u.success).length
      const successRate = totalUses > 0 ? (successfulUses / totalUses) * 100 : 0

      const endpointCounts = new Map<string, number>()
      filteredUsages.forEach(usage => {
        endpointCounts.set(usage.endpoint, (endpointCounts.get(usage.endpoint) || 0) + 1)
      })

      const popularEndpoints = Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const lastUsed = filteredUsages.length > 0
        ? filteredUsages[filteredUsages.length - 1].timestamp
        : undefined

      return {
        totalUses,
        successRate,
        lastUsed,
        popularEndpoints
      }
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      throw new Error('Failed to get usage stats')
    }
  }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager()

// Helper functions for common API key operations
export async function getTwitterCredentials(): Promise<{
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
  bearerToken: string
}> {
  const keys = await apiKeyManager.loadKeys()

  const apiKey = await apiKeyManager.getKey(Array.from(keys.values()).find(k => k.type === 'twitter' && k.name === 'api_key')?.id || '')
  const apiSecret = await apiKeyManager.getKey(Array.from(keys.values()).find(k => k.type === 'twitter' && k.name === 'api_secret')?.id || '')
  const accessToken = await apiKeyManager.getKey(Array.from(keys.values()).find(k => k.type === 'twitter' && k.name === 'access_token')?.id || '')
  const accessTokenSecret = await apiKeyManager.getKey(Array.from(keys.values()).find(k => k.type === 'twitter' && k.name === 'access_token_secret')?.id || '')
  const bearerToken = await apiKeyManager.getKey(Array.from(keys.values()).find(k => k.type === 'twitter' && k.name === 'bearer_token')?.id || '')

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret || !bearerToken) {
    throw new Error('Twitter credentials not found')
  }

  return { apiKey, apiSecret, accessToken, accessTokenSecret, bearerToken }
}

export async function getAICredentials(provider: 'openai' | 'gemini'): Promise<string> {
  const keys = await apiKeyManager.loadKeys()
  const key = Array.from(keys.values()).find(k => k.type === provider)

  if (!key) {
    throw new Error(`${provider} API key not found`)
  }

  return await apiKeyManager.getKey(key.id) || ''
}