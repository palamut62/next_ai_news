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
} from 'firebase/firestore'

// Simple encryption/decryption for API keys
// Note: crypto module only works in Node.js environment (server-side)
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || 'default-dev-key-change-in-production'

// Encryption prefix to mark encrypted data
const ENCRYPTION_PREFIX = 'enc:'

// Lazy load crypto only when needed (server-side)
let cryptoModule: any = null
function getCrypto() {
  if (cryptoModule) return cryptoModule
  try {
    cryptoModule = require('crypto')
    return cryptoModule
  } catch {
    console.warn('⚠️ Crypto module not available in this environment')
    return null
  }
}

export function encryptApiKey(plainKey: string): string {
  try {
    const crypto = getCrypto()
    if (!crypto) {
      console.warn('Encryption failed (crypto unavailable), storing plaintext')
      return plainKey
    }

    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY)
    let encrypted = cipher.update(plainKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    // Add prefix to identify encrypted data
    return ENCRYPTION_PREFIX + encrypted
  } catch (error) {
    console.warn('Encryption failed, storing plaintext:', error)
    return plainKey
  }
}

export function decryptApiKey(encryptedKey: string): string {
  try {
    // Check if it's encrypted (has our prefix)
    if (!encryptedKey.startsWith(ENCRYPTION_PREFIX)) {
      return encryptedKey // Not encrypted, return as-is
    }

    const crypto = getCrypto()
    if (!crypto) {
      console.warn('Decryption failed (crypto unavailable), returning encrypted as-is')
      return encryptedKey
    }

    // Remove prefix and decrypt
    const hexData = encryptedKey.substring(ENCRYPTION_PREFIX.length)
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY)
    let decrypted = decipher.update(hexData, 'hex', 'utf8')
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

// Twitter-specific interface for storing individual keys
export interface TwitterApiKeys {
  id: string
  key_name: string
  api_key: string
  api_secret: string
  access_token: string
  access_token_secret: string
  bearer_token: string
  is_active: boolean
  created_at: string
  updated_at: string
  description?: string
  usage_count: number
  last_used?: string
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

  // Twitter-specific methods
  async saveTwitterApiKey(
    twitterKey: Omit<TwitterApiKeys, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
  ): Promise<TwitterApiKeys> {
    try {
      console.log(`📝 Attempting to save Twitter API key: ${twitterKey.key_name}`)

      if (!db) {
        throw new Error('Firebase Firestore is not initialized')
      }

      // Check if key already exists with same name
      const twitterKeysRef = collection(db, 'twitter_api_keys')
      const q = query(twitterKeysRef, where('key_name', '==', twitterKey.key_name))
      const querySnapshot = await getDocs(q)
      const twitterKeysCollection = collection(db, 'twitter_api_keys')

      if (!querySnapshot.empty) {
        // Update existing
        const existingDoc = querySnapshot.docs[0]
        const docRef = doc(db, 'twitter_api_keys', existingDoc.id)
        const updateData = {
          key_name: twitterKey.key_name,
          api_key: encryptApiKey(twitterKey.api_key),
          api_secret: encryptApiKey(twitterKey.api_secret),
          access_token: encryptApiKey(twitterKey.access_token),
          access_token_secret: encryptApiKey(twitterKey.access_token_secret),
          bearer_token: encryptApiKey(twitterKey.bearer_token),
          is_active: twitterKey.is_active,
          updated_at: new Date().toISOString(),
        } as any

        if (twitterKey.description !== undefined && twitterKey.description !== '') {
          updateData.description = twitterKey.description
        }

        await updateDoc(docRef, updateData)
        console.log(`✅ Twitter API key updated: ${twitterKey.key_name}`)

        return {
          ...existingDoc.data(),
          ...updateData,
          id: existingDoc.id,
        } as TwitterApiKeys
      } else {
        // Create new
        const newData = {
          key_name: twitterKey.key_name,
          api_key: encryptApiKey(twitterKey.api_key),
          api_secret: encryptApiKey(twitterKey.api_secret),
          access_token: encryptApiKey(twitterKey.access_token),
          access_token_secret: encryptApiKey(twitterKey.access_token_secret),
          bearer_token: encryptApiKey(twitterKey.bearer_token),
          is_active: twitterKey.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
        } as any

        if (twitterKey.description !== undefined && twitterKey.description !== '') {
          newData.description = twitterKey.description
        }

        const docRef = await addDoc(twitterKeysCollection, newData)
        console.log(`✅ Twitter API key created: ${twitterKey.key_name}`)

        return {
          id: docRef.id,
          ...newData,
        } as TwitterApiKeys
      }
    } catch (error: any) {
      console.error('❌ Failed to save Twitter API key:', error)
      throw error
    }
  }

  async getAllTwitterApiKeys(): Promise<TwitterApiKeys[]> {
    try {
      const twitterKeysRef = collection(db, 'twitter_api_keys')
      const q = query(twitterKeysRef, orderBy('created_at', 'desc'))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as TwitterApiKeys))
    } catch (error) {
      console.error('Failed to get Twitter API keys from Firebase:', error)
      return []
    }
  }

  async getActiveTwitterApiKey(): Promise<TwitterApiKeys | null> {
    try {
      const twitterKeysRef = collection(db, 'twitter_api_keys')
      // Note: orderBy requires a composite index in Firestore, so we'll fetch all and sort in JS
      const q = query(twitterKeysRef, where('is_active', '==', true))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.warn('⚠️ No active Twitter API key found')
        return null
      }

      // Sort by created_at in JS if we got multiple results
      let docs = querySnapshot.docs
      if (docs.length > 1) {
        docs = docs.sort((a, b) => {
          const dateA = new Date(a.data().created_at || 0).getTime()
          const dateB = new Date(b.data().created_at || 0).getTime()
          return dateB - dateA // descending order
        })
      }

      const doc = docs[0]
      return {
        id: doc.id,
        ...doc.data(),
      } as TwitterApiKeys
    } catch (error) {
      console.error('Failed to get active Twitter API key:', error)
      return null
    }
  }

  async getTwitterApiKeyById(id: string): Promise<TwitterApiKeys | null> {
    try {
      const twitterKeysRef = collection(db, 'twitter_api_keys')
      const docRef = doc(twitterKeysRef, id)
      const docSnapshot = await getDoc(docRef)

      if (!docSnapshot.exists()) {
        return null
      }

      return {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as TwitterApiKeys
    } catch (error) {
      console.error('Failed to get Twitter API key by ID:', error)
      return null
    }
  }

  async deleteTwitterApiKey(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'twitter_api_keys', id)
      await deleteDoc(docRef)
      console.log(`✅ Twitter API key deleted: ${id}`)
      return true
    } catch (error) {
      console.error('Failed to delete Twitter API key:', error)
      return false
    }
  }

  async toggleTwitterApiKeyStatus(id: string, isActive: boolean): Promise<boolean> {
    try {
      const docRef = doc(db, 'twitter_api_keys', id)
      await updateDoc(docRef, {
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })

      console.log(`✅ Twitter API key status toggled: ${id} -> ${isActive ? 'active' : 'inactive'}`)
      return true
    } catch (error) {
      console.error('Failed to toggle Twitter API key status:', error)
      return false
    }
  }

  async recordTwitterKeyUsage(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'twitter_api_keys', id)
      const docSnapshot = await getDoc(docRef)

      if (docSnapshot.exists()) {
        const currentUsage = docSnapshot.data().usage_count || 0
        await updateDoc(docRef, {
          usage_count: currentUsage + 1,
          last_used: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to record Twitter key usage:', error)
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

// Twitter-specific helper functions
export async function getTwitterApiKeys(): Promise<TwitterApiKeys[]> {
  return await firebaseApiKeysManager.getAllTwitterApiKeys()
}

export async function getActiveTwitterApiKey(): Promise<TwitterApiKeys | null> {
  return await firebaseApiKeysManager.getActiveTwitterApiKey()
}

export async function getTwitterApiKeyById(id: string): Promise<TwitterApiKeys | null> {
  return await firebaseApiKeysManager.getTwitterApiKeyById(id)
}

export async function saveTwitterApiKey(
  twitterKey: Omit<TwitterApiKeys, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
): Promise<TwitterApiKeys> {
  return await firebaseApiKeysManager.saveTwitterApiKey(twitterKey)
}

export async function deleteTwitterApiKey(id: string): Promise<boolean> {
  return await firebaseApiKeysManager.deleteTwitterApiKey(id)
}

export async function toggleTwitterApiKeyStatus(id: string, isActive: boolean): Promise<boolean> {
  return await firebaseApiKeysManager.toggleTwitterApiKeyStatus(id, isActive)
}

export async function recordTwitterKeyUsage(id: string): Promise<void> {
  return await firebaseApiKeysManager.recordTwitterKeyUsage(id)
}
