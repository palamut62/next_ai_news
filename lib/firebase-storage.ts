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
  upsert,
  writeBatch,
} from 'firebase/firestore'
import type { Tweet } from './types'

// Tweet interface for Firestore
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

class FirebaseStorage {
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
      const tweetsRef = collection(db, 'tweets')
      const q = query(tweetsRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        console.log('Duplicate tweet detected, skipping save')
        return false
      }

      const tweetRecord: any = {
        id: tweet.id,
        content: tweet.content,
        source: tweet.source,
        source_url: tweet.sourceUrl,
        source_title: tweet.sourceTitle,
        ai_score: tweet.aiScore,
        status: tweet.status,
        created_at: tweet.createdAt,
        engagement: tweet.engagement,
        hash,
      }

      // Only add optional fields if they have values
      if (tweet.postedAt) tweetRecord.posted_at = tweet.postedAt
      if (tweet.twitterId) tweetRecord.twitter_id = tweet.twitterId
      if (tweet.postError) tweetRecord.post_error = tweet.postError
      if (tweet.rejectedAt) tweetRecord.rejected_at = tweet.rejectedAt

      const docRef = await addDoc(tweetsRef, tweetRecord)
      console.log(`✅ Tweet saved to Firebase: ${tweet.id}`)
      return true
    } catch (error) {
      console.error('Failed to save tweet to Firebase:', error)
      return false
    }
  }

  async getAllTweets(): Promise<Tweet[]> {
    try {
      const tweetsRef = collection(db, 'tweets')
      const q = query(tweetsRef, orderBy('created_at', 'desc'))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as TweetRecord
        return {
          id: data.id,
          content: data.content,
          source: data.source,
          sourceUrl: data.source_url,
          sourceTitle: data.source_title,
          aiScore: data.ai_score,
          status: data.status,
          createdAt: data.created_at,
          postedAt: data.posted_at,
          twitterId: data.twitter_id,
          engagement: data.engagement,
          postError: data.post_error,
          rejectedAt: data.rejected_at,
        }
      })
    } catch (error) {
      console.error('Failed to get tweets from Firebase:', error)
      return []
    }
  }

  async updateTweetStatus(
    tweetId: string,
    status: string,
    additionalData?: any
  ): Promise<void> {
    try {
      const tweetsRef = collection(db, 'tweets')
      const q = query(tweetsRef, where('id', '==', tweetId))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        throw new Error(`Tweet ${tweetId} not found`)
      }

      const updateData: any = { status }

      if (status === 'posted') {
        updateData.posted_at = new Date().toISOString()
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString()
      }

      if (additionalData) {
        Object.assign(updateData, additionalData)
      }

      const docRef = doc(db, 'tweets', querySnapshot.docs[0].id)
      await updateDoc(docRef, updateData)

      console.log(`✅ Tweet status updated: ${tweetId} -> ${status}`)
    } catch (error) {
      console.error('Failed to update tweet status:', error)
      throw error
    }
  }

  async isDuplicateTweet(content: string, sourceTitle: string): Promise<boolean> {
    try {
      const hash = this.generateHash(content, sourceTitle)
      const tweetsRef = collection(db, 'tweets')
      const q = query(tweetsRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      return !querySnapshot.empty
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
      const articlesRef = collection(db, 'rejected_articles')
      const q = query(articlesRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
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
        hash,
      }

      await addDoc(articlesRef, rejectedArticle)
      console.log(`✅ Rejected article saved: ${article.title.substring(0, 50)}...`)
    } catch (error) {
      console.error('Failed to add rejected article:', error)
      throw error
    }
  }

  async isArticleRejected(title: string, url: string): Promise<boolean> {
    try {
      const hash = this.generateHash(title, url)
      const articlesRef = collection(db, 'rejected_articles')
      const q = query(articlesRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      return !querySnapshot.empty
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
      const reposRef = collection(db, 'rejected_github_repos')
      const q = query(reposRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
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
        hash,
      }

      await addDoc(reposRef, rejectedRepo)
      console.log(`✅ Rejected GitHub repo saved: ${repo.fullName}`)
    } catch (error) {
      console.error('Failed to add rejected GitHub repo:', error)
      throw error
    }
  }

  async isGitHubRepoRejected(fullName: string, url: string): Promise<boolean> {
    try {
      const hash = this.generateHash(fullName, url)
      const reposRef = collection(db, 'rejected_github_repos')
      const q = query(reposRef, where('hash', '==', hash))
      const querySnapshot = await getDocs(q)

      return !querySnapshot.empty
    } catch (error) {
      console.error('Failed to check if GitHub repo is rejected:', error)
      return false
    }
  }

  async deleteTweet(tweetId: string): Promise<boolean> {
    try {
      const tweetsRef = collection(db, 'tweets')
      const q = query(tweetsRef, where('id', '==', tweetId))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.error(`Tweet ${tweetId} not found`)
        return false
      }

      const docRef = doc(db, 'tweets', querySnapshot.docs[0].id)
      await deleteDoc(docRef)

      console.log(`✅ Tweet deleted from Firebase: ${tweetId}`)
      return true
    } catch (error) {
      console.error('Failed to delete tweet from Firebase:', error)
      return false
    }
  }

  // Settings operations
  async saveSettings(settings: any): Promise<boolean> {
    try {
      const settingsRef = collection(db, 'settings')
      const q = query(settingsRef, where('id', '==', 'default'))
      const querySnapshot = await getDocs(q)

      const settingsRecord: SettingsRecord = {
        id: 'default',
        ...settings,
        updated_at: new Date().toISOString(),
      }

      if (!querySnapshot.empty) {
        // Update existing settings
        const docRef = doc(db, 'settings', querySnapshot.docs[0].id)
        await updateDoc(docRef, settingsRecord)
      } else {
        // Create new settings
        await addDoc(settingsRef, settingsRecord)
      }

      console.log('✅ Settings saved to Firebase')
      return true
    } catch (error) {
      console.error('Failed to save settings to Firebase:', error)
      return false
    }
  }

  async getSettings(): Promise<any | null> {
    try {
      const settingsRef = collection(db, 'settings')
      const q = query(settingsRef, where('id', '==', 'default'))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.log('No settings found in Firebase')
        return null
      }

      const data = querySnapshot.docs[0].data() as SettingsRecord
      const { id, updated_at, ...settings } = data

      console.log('✅ Settings loaded from Firebase')
      return settings
    } catch (error) {
      console.error('Failed to get settings from Firebase:', error)
      return null
    }
  }
}

// Export singleton instance
export const firebaseStorage = new FirebaseStorage()
