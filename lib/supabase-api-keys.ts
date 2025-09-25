import { createClient, SupabaseClient } from '@supabase/supabase-js'

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

class SupabaseApiKeysManager {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables')
    }

    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // Get all API keys
  async getAllApiKeys(): Promise<ApiKey[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase get API keys error:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to get API keys from Supabase:', error)
      return []
    }
  }

  // Get API key by service
  async getApiKey(service: string): Promise<ApiKey | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('service', service)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error(`Supabase get API key error for ${service}:`, error)
        return null
      }

      return data
    } catch (error) {
      console.error(`Failed to get API key for ${service}:`, error)
      return null
    }
  }

  // Save or update API key
  async saveApiKey(apiKey: Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<ApiKey> {
    try {
      // Check if key already exists for this service
      const existingKey = await this.getApiKey(apiKey.service)

      if (existingKey) {
        // Update existing key
        const { data, error } = await this.supabase
          .from('api_keys')
          .update({
            key_name: apiKey.key_name,
            api_key: apiKey.api_key,
            is_active: apiKey.is_active,
            updated_at: new Date().toISOString(),
            description: apiKey.description
          })
          .eq('id', existingKey.id)
          .select()
          .single()

        if (error) {
          console.error('Supabase update API key error:', error)
          throw error
        }

        console.log(`✅ API key updated: ${apiKey.service}`)
        return data
      } else {
        // Create new key
        const { data, error } = await this.supabase
          .from('api_keys')
          .insert([{
            ...apiKey,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            usage_count: 0
          }])
          .select()
          .single()

        if (error) {
          console.error('Supabase save API key error:', error)
          throw error
        }

        console.log(`✅ API key saved: ${apiKey.service}`)
        return data
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
      throw error
    }
  }

  // Delete API key
  async deleteApiKey(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('api_keys')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Supabase delete API key error:', error)
        return false
      }

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
      const { error } = await this.supabase
        .from('api_keys')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('Supabase toggle API key status error:', error)
        return false
      }

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

      const { error } = await this.supabase
        .from('api_keys')
        .update({
          usage_count: apiKey.usage_count + 1,
          last_used: new Date().toISOString()
        })
        .eq('id', apiKey.id)

      if (error) {
        console.error('Supabase record API key usage error:', error)
      }
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
        example: 'sk-...'
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        service: 'anthropic',
        api_key_field: 'ANTHROPIC_API_KEY',
        description: 'For AI text generation with Claude',
        required: false,
        example: 'sk-ant-...'
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        service: 'gemini',
        api_key_field: 'GEMINI_API_KEY',
        description: 'For AI text generation with Gemini',
        required: false,
        example: 'AIza...'
      },
      {
        id: 'twitter',
        name: 'Twitter API',
        service: 'twitter',
        api_key_field: 'TWITTER_API_KEY',
        description: 'For posting tweets to Twitter',
        required: true,
        example: 'Bearer...'
      },
      {
        id: 'github',
        name: 'GitHub API',
        service: 'github',
        api_key_field: 'GITHUB_TOKEN',
        description: 'For fetching GitHub repositories',
        required: false,
        example: 'ghp_...'
      },
      {
        id: 'techcrunch',
        name: 'TechCrunch API',
        service: 'techcrunch',
        api_key_field: 'TECHCRUNCH_API_KEY',
        description: 'For fetching TechCrunch articles',
        required: false,
        example: 'tc-...'
      }
    ]
  }
}

// Export singleton instance
export const supabaseApiKeysManager = new SupabaseApiKeysManager()

// Helper functions
export async function getApiKey(service: string): Promise<string | null> {
  return await supabaseApiKeysManager.getActiveApiKey(service)
}

export async function saveApiKey(apiKey: Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<ApiKey> {
  return await supabaseApiKeysManager.saveApiKey(apiKey)
}

export async function getAllApiKeys(): Promise<ApiKey[]> {
  return await supabaseApiKeysManager.getAllApiKeys()
}

export async function deleteApiKey(id: string): Promise<boolean> {
  return await supabaseApiKeysManager.deleteApiKey(id)
}

export async function toggleApiKeyStatus(id: string, isActive: boolean): Promise<boolean> {
  return await supabaseApiKeysManager.toggleApiKeyStatus(id, isActive)
}