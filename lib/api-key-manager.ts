import { encryptData, decryptData, generateSecureToken } from './security-utils'
import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'

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
  private keysCache: Map<string, APIKey> = new Map()
  private lastCacheUpdate = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  async loadKeys(): Promise<Map<string, APIKey>> {
    try {
      // Use cache if still valid
      if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL && this.keysCache.size > 0) {
        return this.keysCache
      }

      if (!db) {
        console.warn('Firebase not initialized, returning empty cache')
        return new Map()
      }

      const keysRef = collection(db, 'api_keys')
      const snapshot = await getDocs(keysRef)

      this.keysCache = new Map()
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        this.keysCache.set(doc.id, {
          id: doc.id,
          name: data.name,
          encryptedKey: data.encryptedKey,
          iv: data.iv,
          tag: data.tag,
          type: data.type,
          environment: data.environment,
          createdAt: data.createdAt,
          lastUsed: data.lastUsed,
          expiresAt: data.expiresAt,
          rotationRequired: data.rotationRequired || false,
          accessCount: data.accessCount || 0,
        } as APIKey)
      })

      this.lastCacheUpdate = Date.now()
      return this.keysCache
    } catch (error) {
      console.error('Failed to load API keys from Firebase:', error)
      return new Map()
    }
  }

  async saveKey(key: APIKey): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const keysRef = collection(db, 'api_keys')
      const keyRef = doc(keysRef, key.id)

      await updateDoc(keyRef, {
        name: key.name,
        encryptedKey: key.encryptedKey,
        iv: key.iv,
        tag: key.tag,
        type: key.type,
        environment: key.environment,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        expiresAt: key.expiresAt,
        rotationRequired: key.rotationRequired,
        accessCount: key.accessCount,
      }).catch(async (error: any) => {
        // If document doesn't exist, create it
        if (error.code === 'not-found') {
          await addDoc(keysRef, {
            id: key.id,
            name: key.name,
            encryptedKey: key.encryptedKey,
            iv: key.iv,
            tag: key.tag,
            type: key.type,
            environment: key.environment,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            expiresAt: key.expiresAt,
            rotationRequired: key.rotationRequired,
            accessCount: key.accessCount,
          })
        } else {
          throw error
        }
      })

      // Update cache
      this.keysCache.set(key.id, key)
      this.lastCacheUpdate = Date.now()
    } catch (error) {
      console.error('Failed to save API key to Firebase:', error)
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
        accessCount: 0,
      }

      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const keysRef = collection(db, 'api_keys')
      await addDoc(keysRef, {
        id: key.id,
        name: key.name,
        encryptedKey: key.encryptedKey,
        iv: key.iv,
        tag: key.tag,
        type: key.type,
        environment: key.environment,
        createdAt: key.createdAt,
        rotationRequired: key.rotationRequired,
        accessCount: key.accessCount,
      })

      // Log key creation
      await this.logKeyUsage({
        keyId: key.id,
        timestamp: new Date().toISOString(),
        endpoint: 'create_key',
        success: true,
      })

      // Update cache
      this.keysCache.set(key.id, key)
      this.lastCacheUpdate = Date.now()

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
      await this.saveKey(key)

      // Log key access
      await this.logKeyUsage({
        keyId: key.id,
        timestamp: new Date().toISOString(),
        endpoint: 'get_key',
        success: true,
      })

      return decryptData(key.encryptedKey, key.iv, key.tag)
    } catch (error) {
      console.error('Failed to get API key:', error)
      await this.logKeyUsage({
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: 'get_key',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
        lastUsed: new Date().toISOString(),
      }

      await this.saveKey(updatedKey)

      // Log key rotation
      await this.logKeyUsage({
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: 'rotate_key',
        success: true,
      })

      return updatedKey
    } catch (error) {
      console.error('Failed to rotate API key:', error)
      throw new Error('Failed to rotate API key')
    }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    try {
      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const keysRef = collection(db, 'api_keys')
      const q = query(keysRef, where('id', '==', keyId))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        return false
      }

      const docRef = snapshot.docs[0].ref
      await deleteDoc(docRef)

      // Log key deletion
      await this.logKeyUsage({
        keyId,
        timestamp: new Date().toISOString(),
        endpoint: 'delete_key',
        success: true,
      })

      // Update cache
      this.keysCache.delete(keyId)
      this.lastCacheUpdate = Date.now()

      return true
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
        tag: '[REDACTED]',
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
        await this.saveKey(key)

        // Log rotation requirement
        await this.logKeyUsage({
          keyId,
          timestamp: new Date().toISOString(),
          endpoint: 'mark_rotation',
          success: true,
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
        highUsage,
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
      if (!db) {
        console.warn('Firebase not initialized, skipping usage log')
        return
      }

      const usageRef = collection(db, 'api_key_usage')
      await addDoc(usageRef, {
        ...usage,
        createdAt: Timestamp.now(),
      })
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
      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const usageRef = collection(db, 'api_key_usage')
      let q = query(usageRef, orderBy('createdAt', 'desc'))

      if (keyId) {
        q = query(usageRef, where('keyId', '==', keyId), orderBy('createdAt', 'desc'))
      }

      const snapshot = await getDocs(q)
      const usages = snapshot.docs.map(doc => doc.data() as APIKeyUsage)

      const totalUses = usages.length
      const successfulUses = usages.filter(u => u.success).length
      const successRate = totalUses > 0 ? (successfulUses / totalUses) * 100 : 0

      const endpointCounts = new Map<string, number>()
      usages.forEach(usage => {
        endpointCounts.set(usage.endpoint, (endpointCounts.get(usage.endpoint) || 0) + 1)
      })

      const popularEndpoints = Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const lastUsed = usages.length > 0 ? usages[0].timestamp : undefined

      return {
        totalUses,
        successRate,
        lastUsed,
        popularEndpoints,
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

  return (await apiKeyManager.getKey(key.id)) || ''
}
