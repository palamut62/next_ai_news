import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import crypto from 'crypto'

// Simple encryption/decryption for API keys
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || 'default-dev-key-change-in-production'

export function encryptApiKey(plainKey: string): string {
  try {
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY)
    let encrypted = cipher.update(plainKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  } catch (error) {
    console.warn('Encryption failed, storing plaintext:', error)
    return plainKey
  }
}

export function decryptApiKey(encryptedKey: string): string {
  try {
    // Check if it looks like encrypted data (hex string)
    if (!/^[a-f0-9]+$/.test(encryptedKey)) {
      return encryptedKey // Not encrypted, return as-is
    }
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY)
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.warn('Decryption failed, returning as plaintext:', error)
    return encryptedKey
  }
}

export interface ApiKey {
  id: string
  service: string
  key_name: string
  api_key: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_used?: string
  usage_count: number
  description?: string
}

export interface ApiProvider {
  id: string
  name: string
  service: string
  api_key_field: string
  description: string
  required: boolean
  example?: string
}

class FirebaseApiKeysManager {
  // Get all API keys
  async getAllApiKeys(): Promise<ApiKey[]> {
    try {
      const apiKeysRef = collection(db, 'api_keys')
      const q = query(apiKeysRef, orderBy('created_at', 'desc'))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ApiKey))
    } catch (error) {
      console.error('Failed to get API keys from Firebase:', error)
      return []
    }
  }

  // Get API key by service
  async getApiKey(service: string): Promise<ApiKey | null> {
    try {
      const apiKeysRef = collection(db, 'api_keys')
      const q = query(apiKeysRef, where('service', '==', service), where('is_active', '==', true))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return null
      }

      const doc = querySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
      } as ApiKey
    } catch (error) {
      console.error(`Failed to get API key for ${service}:`, error)
      return null
    }
  }

  // Save or update API key
  async saveApiKey(
    apiKey: Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
  ): Promise<ApiKey> {
    try {
      console.log(`📝 Attempting to save API key for service: ${apiKey.service}`)

      // Check if Firebase is properly initialized
      if (!db) {
        const error = new Error('Firebase Firestore is not initialized')
        console.error('❌ Firebase DB not initialized')
        throw error
      }

      // Check if key already exists for this service
      console.log(`🔍 Checking for existing key for service: ${apiKey.service}`)
      const existingKey = await this.getApiKey(apiKey.service)
      const apiKeysRef = collection(db, 'api_keys')

      if (existingKey) {
        // Update existing key
        console.log(`🔄 Updating existing key ID: ${existingKey.id}`)
        const docRef = doc(db, 'api_keys', existingKey.id)
        const updateData: any = {
          key_name: apiKey.key_name,
          api_key: encryptApiKey(apiKey.api_key),
          is_active: apiKey.is_active,
          updated_at: new Date().toISOString(),
        }

        // Only add description if it's not undefined
        if (apiKey.description !== undefined && apiKey.description !== '') {
          updateData.description = apiKey.description
        }

        await updateDoc(docRef, updateData)
        console.log(`✅ API key updated successfully: ${apiKey.service}`)

        return {
          ...existingKey,
          ...updateData,
        } as ApiKey
      } else {
        // Create new key
        console.log(`➕ Creating new API key for service: ${apiKey.service}`)
        const newApiKey: any = {
          service: apiKey.service,
          key_name: apiKey.key_name,
          api_key: encryptApiKey(apiKey.api_key),
          is_active: apiKey.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
        }

        // Only add description if it's not undefined
        if (apiKey.description !== undefined && apiKey.description !== '') {
          newApiKey.description = apiKey.description
        }

        const docRef = await addDoc(apiKeysRef, newApiKey)
        console.log(`✅ API key saved successfully with ID: ${docRef.id}`)

        return {
          id: docRef.id,
          ...newApiKey,
        } as ApiKey
      }
    } catch (error: any) {
      console.error('❌ Failed to save API key:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      })

      // Re-throw with more context
      if (error?.code === 'permission-denied') {
        throw new Error('Firebase permission denied. Please check Firestore security rules.')
      } else if (error?.code === 'unavailable') {
        throw new Error('Firebase service unavailable. Please check your internet connection.')
      } else {
        throw new Error(`Failed to save API key: ${error?.message || 'Unknown error'}`)
      }
    }
  }

  // Delete API key
  async deleteApiKey(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'api_keys', id)
      await deleteDoc(docRef)
      console.log(`✅ API key deleted: ${id}`)
      return true
    } catch (error) {
      console.error('Failed to delete API key:', error)
      return false
    }
  }

  // Toggle API key active status
  async toggleApiKeyStatus(id: string, isActive: boolean): Promise<boolean> {
    try {
      const docRef = doc(db, 'api_keys', id)
      await updateDoc(docRef, {
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })

      console.log(`✅ API key status toggled: ${id} -> ${isActive ? 'active' : 'inactive'}`)
      return true
    } catch (error) {
      console.error('Failed to toggle API key status:', error)
      return false
    }
  }

  // Record API key usage
  async recordUsage(service: string): Promise<void> {
    try {
      const apiKey = await this.getApiKey(service)
      if (!apiKey) return

      const docRef = doc(db, 'api_keys', apiKey.id)
      await updateDoc(docRef, {
        usage_count: (apiKey.usage_count || 0) + 1,
        last_used: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to record API key usage:', error)
    }
  }

  // Get active API key for service
  async getActiveApiKey(service: string): Promise<string | null> {
    try {
      const apiKey = await this.getApiKey(service)
      return apiKey?.api_key || null
    } catch (error) {
      console.error(`Failed to get active API key for ${service}:`, error)
      return null
    }
  }

  // Get available API providers
  getApiProviders(): ApiProvider[] {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        service: 'openai',
        api_key_field: 'OPENAI_API_KEY',
        description: 'For AI text generation and analysis',
        required: true,
        example: 'sk-...',
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        service: 'anthropic',
        api_key_field: 'ANTHROPIC_API_KEY',
        description: 'For AI text generation with Claude',
        required: false,
        example: 'sk-ant-...',
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        service: 'gemini',
        api_key_field: 'GEMINI_API_KEY',
        description: 'For AI text generation with Gemini',
        required: false,
        example: 'AIza...',
      },
      {
        id: 'twitter',
        name: 'Twitter API',
        service: 'twitter',
        api_key_field: 'TWITTER_API_KEY',
        description: 'For posting tweets to Twitter',
        required: true,
        example: 'Bearer...',
      },
      {
        id: 'github',
        name: 'GitHub API',
        service: 'github',
        api_key_field: 'GITHUB_TOKEN',
        description: 'For fetching GitHub repositories',
        required: false,
        example: 'ghp_...',
      },
      {
        id: 'techcrunch',
        name: 'TechCrunch API',
        service: 'techcrunch',
        api_key_field: 'TECHCRUNCH_API_KEY',
        description: 'For fetching TechCrunch articles',
        required: false,
        example: 'tc-...',
      },
    ]
  }
}

// Export singleton instance
export const firebaseApiKeysManager = new FirebaseApiKeysManager()

// Helper functions
export async function getApiKey(service: string): Promise<string | null> {
  return await firebaseApiKeysManager.getActiveApiKey(service)
}

export async function saveApiKey(
  apiKey: Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
): Promise<ApiKey> {
  return await firebaseApiKeysManager.saveApiKey(apiKey)
}

export async function getAllApiKeys(): Promise<ApiKey[]> {
  return await firebaseApiKeysManager.getAllApiKeys()
}

export async function deleteApiKey(id: string): Promise<boolean> {
  return await firebaseApiKeysManager.deleteApiKey(id)
}

export async function toggleApiKeyStatus(id: string, isActive: boolean): Promise<boolean> {
  return await firebaseApiKeysManager.toggleApiKeyStatus(id, isActive)
}

// Helper function to get API key from Firebase or environment variables (fallback)
export async function getApiKeyFromFirebaseOrEnv(service: string, envVarName?: string): Promise<string | null> {
  try {
    // First, try to get from Firebase
    const apiKey = await getApiKey(service)
    if (apiKey) {
      console.log(`✅ API key loaded from Firebase for service: ${service}`)
      return apiKey
    }

    // Fallback to environment variable if provided
    if (envVarName) {
      const envKey = process.env[envVarName]
      if (envKey && envKey !== `your_${envVarName.toLowerCase()}_here`) {
        console.log(`⚠️ API key loaded from environment variable for service: ${service}`)
        return envKey
      }
    }

    console.warn(`❌ No API key found for service: ${service}`)
    return null
  } catch (error) {
    console.error(`Error getting API key for ${service}:`, error)
    // Fallback to environment variable if Firebase fails
    if (envVarName) {
      const envKey = process.env[envVarName]
      if (envKey && envKey !== `your_${envVarName.toLowerCase()}_here`) {
        return envKey
      }
    }
    return null
  }
}
