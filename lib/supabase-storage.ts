import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Tweet } from './types'

// Tweet interface for database
export interface TweetRecord {
  id: string
  content: string
  source: string
  source_url: string
  source_title: string
  ai_score: number
  status: 'pending' | 'approved' | 'rejected' | 'posted'
  created_at: string
  posted_at?: string
  twitter_id?: string
  engagement?: {
    likes: number
    retweets: number
    replies: number
  }
  post_error?: string
  rejected_at?: string
  hash: string
}

// Rejected article interface
export interface RejectedArticleRecord {
  id: string
  title: string
  url: string
  source: string
  published_at: string
  description?: string
  rejected_at: string
  reason?: string
  hash: string
}

// Rejected GitHub repo interface
export interface RejectedGitHubRepoRecord {
  id: string
  name: string
  url: string
  full_name: string
  description?: string
  language?: string
  stars: number
  rejected_at: string
  reason?: string
  hash: string
}

// Settings interface
export interface SettingsRecord {
  id: string
  automation: {
    enabled: boolean
    checkInterval: number
    maxArticlesPerCheck: number
    minAiScore: number
    autoPost: boolean
    requireApproval: boolean
    rateLimitDelay: number
  }
  github: {
    enabled: boolean
    languages: string[]
    timeRange: string
    maxRepos: number
    minStars: number
  }
  notifications: {
    telegram: {
      enabled: boolean
      botToken: string
      chatId: string
    }
    email: {
      enabled: boolean
      smtpHost: string
      smtpPort: number
      username: string
      password: string
      fromEmail: string
      toEmail: string
    }
  }
  twitter: {
    apiKey: string
    apiSecret: string
    accessToken: string
    accessTokenSecret: string
  }
  ai: {
    provider: string
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
  }
  apiUrl: string
  updated_at: string
}

class SupabaseStorage {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables')
    }

    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // Generate hash for duplicate detection
  generateHash(content: string, sourceTitle: string): string {
    const normalizedContent = content.trim().toLowerCase()
    const normalizedTitle = sourceTitle.trim().toLowerCase()
    const combined = `${normalizedContent}|${normalizedTitle}`

    // Simple hash function
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString()
  }

  // Tweet operations
  async saveTweet(tweet: Tweet): Promise<boolean> {
    try {
      const hash = this.generateHash(tweet.content, tweet.sourceTitle)

      // Check for duplicates
      const { data: existingTweet } = await this.supabase
        .from('tweets')
        .select('id')
        .eq('hash', hash)
        .single()

      if (existingTweet) {
        console.log('Duplicate tweet detected, skipping save')
        return false
      }

      const tweetRecord: TweetRecord = {
        id: tweet.id,
        content: tweet.content,
        source: tweet.source,
        source_url: tweet.sourceUrl,
        source_title: tweet.sourceTitle,
        ai_score: tweet.aiScore,
        status: tweet.status,
        created_at: tweet.createdAt,
        posted_at: tweet.postedAt,
        twitter_id: tweet.twitterId,
        engagement: tweet.engagement,
        post_error: tweet.postError,
        rejected_at: tweet.rejectedAt,
        hash
      }

      const { error } = await this.supabase
        .from('tweets')
        .insert([tweetRecord])

      if (error) {
        console.error('Supabase save tweet error:', error)
        return false
      }

      console.log(`✅ Tweet saved to Supabase: ${tweet.id}`)
      return true
    } catch (error) {
      console.error('Failed to save tweet to Supabase:', error)
      return false
    }
  }

  async getAllTweets(): Promise<Tweet[]> {
    try {
      const { data, error } = await this.supabase
        .from('tweets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase get tweets error:', error)
        return []
      }

      return data.map(record => ({
        id: record.id,
        content: record.content,
        source: record.source,
        sourceUrl: record.source_url,
        sourceTitle: record.source_title,
        aiScore: record.ai_score,
        status: record.status,
        createdAt: record.created_at,
        postedAt: record.posted_at,
        twitterId: record.twitter_id,
        engagement: record.engagement,
        postError: record.post_error,
        rejectedAt: record.rejected_at
      }))
    } catch (error) {
      console.error('Failed to get tweets from Supabase:', error)
      return []
    }
  }

  async updateTweetStatus(tweetId: string, status: string, additionalData?: any): Promise<void> {
    try {
      const updateData: any = { status }

      if (status === 'posted') {
        updateData.posted_at = new Date().toISOString()
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString()
      }

      if (additionalData) {
        Object.assign(updateData, additionalData)
      }

      const { error } = await this.supabase
        .from('tweets')
        .update(updateData)
        .eq('id', tweetId)

      if (error) {
        console.error('Supabase update tweet status error:', error)
        throw error
      }

      console.log(`✅ Tweet status updated: ${tweetId} -> ${status}`)
    } catch (error) {
      console.error('Failed to update tweet status:', error)
      throw error
    }
  }

  async isDuplicateTweet(content: string, sourceTitle: string): Promise<boolean> {
    try {
      const hash = this.generateHash(content, sourceTitle)

      const { data, error } = await this.supabase
        .from('tweets')
        .select('id')
        .eq('hash', hash)
        .single()

      return !!data
    } catch (error) {
      console.error('Failed to check duplicate tweet:', error)
      return false
    }
  }

  // Rejected articles operations
  async addRejectedArticle(article: {
    title: string
    url: string
    source: string
    publishedAt: string
    description?: string
    reason?: string
  }): Promise<void> {
    try {
      const hash = this.generateHash(article.title, article.url)

      // Check if already rejected
      const { data: existing } = await this.supabase
        .from('rejected_articles')
        .select('id')
        .eq('hash', hash)
        .single()

      if (existing) {
        console.log('Article already rejected, skipping')
        return
      }

      const rejectedArticle: RejectedArticleRecord = {
        id: `rejected_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        title: article.title,
        url: article.url,
        source: article.source,
        published_at: article.publishedAt,
        description: article.description,
        rejected_at: new Date().toISOString(),
        reason: article.reason,
        hash
      }

      const { error } = await this.supabase
        .from('rejected_articles')
        .insert([rejectedArticle])

      if (error) {
        console.error('Supabase add rejected article error:', error)
        throw error
      }

      console.log(`✅ Rejected article saved: ${article.title.substring(0, 50)}...`)
    } catch (error) {
      console.error('Failed to add rejected article:', error)
      throw error
    }
  }

  async isArticleRejected(title: string, url: string): Promise<boolean> {
    try {
      const hash = this.generateHash(title, url)

      const { data, error } = await this.supabase
        .from('rejected_articles')
        .select('id')
        .eq('hash', hash)
        .single()

      return !!data
    } catch (error) {
      console.error('Failed to check if article is rejected:', error)
      return false
    }
  }

  // Rejected GitHub repos operations
  async addRejectedGitHubRepo(repo: {
    fullName: string
    url: string
    name: string
    description?: string
    language?: string
    stars: number
    reason?: string
  }): Promise<void> {
    try {
      const hash = this.generateHash(repo.fullName, repo.url)

      // Check if already rejected
      const { data: existing } = await this.supabase
        .from('rejected_github_repos')
        .select('id')
        .eq('hash', hash)
        .single()

      if (existing) {
        console.log('GitHub repo already rejected, skipping')
        return
      }

      const rejectedRepo: RejectedGitHubRepoRecord = {
        id: `rejected_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        name: repo.name,
        url: repo.url,
        full_name: repo.fullName,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        rejected_at: new Date().toISOString(),
        reason: repo.reason,
        hash
      }

      const { error } = await this.supabase
        .from('rejected_github_repos')
        .insert([rejectedRepo])

      if (error) {
        console.error(' Supabase add rejected GitHub repo error:', error)
        throw error
      }

      console.log(`✅ Rejected GitHub repo saved: ${repo.fullName}`)
    } catch (error) {
      console.error('Failed to add rejected GitHub repo:', error)
      throw error
    }
  }

  async isGitHubRepoRejected(fullName: string, url: string): Promise<boolean> {
    try {
      const hash = this.generateHash(fullName, url)

      const { data, error } = await this.supabase
        .from('rejected_github_repos')
        .select('id')
        .eq('hash', hash)
        .single()

      return !!data
    } catch (error) {
      console.error('Failed to check if GitHub repo is rejected:', error)
      return false
    }
  }

  async deleteTweet(tweetId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('tweets')
        .delete()
        .eq('id', tweetId)

      if (error) {
        console.error('Supabase delete tweet error:', error)
        return false
      }

      console.log(`✅ Tweet deleted from Supabase: ${tweetId}`)
      return true
    } catch (error) {
      console.error('Failed to delete tweet from Supabase:', error)
      return false
    }
  }

  // Settings operations
  async saveSettings(settings: any): Promise<boolean> {
    try {
      const settingsRecord: SettingsRecord = {
        id: 'default', // Use a fixed ID for single settings record
        ...settings,
        updated_at: new Date().toISOString()
      }

      const { error } = await this.supabase
        .from('settings')
        .upsert(settingsRecord, { onConflict: 'id' })

      if (error) {
        console.error('Supabase save settings error:', error)
        return false
      }

      console.log('✅ Settings saved to Supabase')
      return true
    } catch (error) {
      console.error('Failed to save settings to Supabase:', error)
      return false
    }
  }

  async getSettings(): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .select('*')
        .eq('id', 'default')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, return null
          console.log('No settings found in Supabase')
          return null
        }
        console.error('Supabase get settings error:', error)
        return null
      }

      if (!data) {
        console.log('No settings data found')
        return null
      }

      // Remove internal fields before returning
      const { id, updated_at, ...settings } = data
      console.log('✅ Settings loaded from Supabase')
      return settings
    } catch (error) {
      console.error('Failed to get settings from Supabase:', error)
      return null
    }
  }
}

// Export singleton instance
export const supabaseStorage = new SupabaseStorage()