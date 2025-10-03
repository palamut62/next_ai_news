import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

interface NewsArticle {
  id?: string
  title: string
  url: string
  source: string
  publishedAt: string
  content?: string
  author?: string
  description?: string
}

interface ProcessedArticle extends NewsArticle {
  hash: string
  processedAt: string
  lastSeen: string
  timesProcessed: number
  sources: string[]
}

class NewsDuplicateDetector {
  private readonly ARTICLES_FILE: string
  private articlesCache: Map<string, ProcessedArticle> = new Map()
  private lastCacheUpdate = 0
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  constructor() {
    // Use temporary directory for Vercel compatibility
    const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')
    this.ARTICLES_FILE = path.join(tmpDir, 'processed-articles.json')
  }

  private async ensureDataDirectory(): Promise<void> {
    const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')
    try {
      await fs.access(tmpDir)
      console.log(`✅ Data directory accessible: ${tmpDir}`)
    } catch {
      try {
        await fs.mkdir(tmpDir, { recursive: true })
        console.log(`✅ Created data directory: ${tmpDir}`)
      } catch (mkdirError) {
        console.error(`❌ Failed to create data directory: ${tmpDir}`, mkdirError)
        // Fallback to memory-only mode
        throw new Error(`Cannot access or create data directory: ${tmpDir}`)
      }
    }
  }

  async loadArticles(): Promise<Map<string, ProcessedArticle>> {
    try {
      // Use cache if still valid
      if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL && this.articlesCache.size > 0) {
        console.log(`📦 Using cached articles (${this.articlesCache.size} items)`)
        return this.articlesCache
      }

      await this.ensureDataDirectory()
      console.log(`📂 Loading articles from: ${this.ARTICLES_FILE}`)
      const data = await fs.readFile(this.ARTICLES_FILE, 'utf-8')
      const articles: ProcessedArticle[] = JSON.parse(data)

      this.articlesCache = new Map(articles.map(article => [article.hash, article]))
      this.lastCacheUpdate = Date.now()

      console.log(`✅ Loaded ${articles.length} processed articles from disk`)
      return this.articlesCache
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`📄 No existing articles file found, starting fresh`)
        return new Map()
      }
      console.error('❌ Failed to load articles:', error)
      // Return empty map instead of throwing to avoid breaking the main functionality
      return new Map()
    }
  }

  async saveArticles(articles: Map<string, ProcessedArticle>): Promise<void> {
    try {
      await this.ensureDataDirectory()
      const data = Array.from(articles.values())
      await fs.writeFile(this.ARTICLES_FILE, JSON.stringify(data, null, 2))

      // Update cache
      this.articlesCache = articles
      this.lastCacheUpdate = Date.now()
      console.log(`💾 Saved ${articles.size} processed articles to disk`)
    } catch (error) {
      console.error('❌ Failed to save processed articles:', error)
      // Don't throw error to avoid breaking the main functionality
      console.log('⚠️ Continuing with memory-only mode for duplicate detection')
    }
  }

  // Generate a hash for duplicate detection
  generateArticleHash(article: NewsArticle): string {
    // Normalize title for better duplicate detection
    const normalizedTitle = this.normalizeText(article.title)

    // Create content fingerprint
    const contentFingerprint = this.createContentFingerprint(article)

    // Combine title and content for hash
    const combinedData = `${normalizedTitle}|${contentFingerprint}|${article.source}`

    return crypto.createHash('sha256').update(combinedData).digest('hex')
  }

  // Normalize text for comparison
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  // Create content fingerprint for better duplicate detection
  private createContentFingerprint(article: NewsArticle): string {
    let content = article.description || article.content || ''

    // If content is too long, use first and last parts
    if (content.length > 500) {
      const firstPart = content.substring(0, 200)
      const lastPart = content.substring(content.length - 200)
      content = `${firstPart}...${lastPart}`
    }

    return this.normalizeText(content)
  }

  // Check if an article is a duplicate
  async isDuplicate(article: NewsArticle, options: {
    titleSimilarity?: number
    contentSimilarity?: number
    timeWindow?: number // hours
  } = {}): Promise<{
    isDuplicate: boolean
    existingArticle?: ProcessedArticle
    similarity: number
    reason: string
  }> {
    const {
      titleSimilarity = 0.85,
      contentSimilarity = 0.7,
      timeWindow = 24 // 24 hours
    } = options

    try {
      const articles = await this.loadArticles()
      const articleHash = this.generateArticleHash(article)

      // Check exact hash match
      if (articles.has(articleHash)) {
        const existing = articles.get(articleHash)!
        return {
          isDuplicate: true,
          existingArticle: existing,
          similarity: 1.0,
          reason: 'exact_hash_match'
        }
      }

      // Check for similar articles within time window
      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000)

      for (const [hash, existing] of articles) {
        const existingTime = new Date(existing.publishedAt)

        // Skip articles outside time window
        if (existingTime < cutoffTime) {
          continue
        }

        // Calculate similarity
        const similarity = this.calculateSimilarity(article, existing)

        if (similarity >= titleSimilarity) {
          return {
            isDuplicate: true,
            existingArticle: existing,
            similarity,
            reason: `title_similarity_${(similarity * 100).toFixed(1)}%`
          }
        }
      }

      return {
        isDuplicate: false,
        similarity: 0,
        reason: 'no_similar_articles'
      }

    } catch (error) {
      console.error('Duplicate detection error:', error)
      return {
        isDuplicate: false,
        similarity: 0,
        reason: 'error_in_detection'
      }
    }
  }

  // Calculate similarity between two articles
  private calculateSimilarity(article1: NewsArticle, article2: NewsArticle): number {
    // Title similarity (most important)
    const title1 = this.normalizeText(article1.title)
    const title2 = this.normalizeText(article2.title)

    const titleSimilarity = this.calculateStringSimilarity(title1, title2)

    // Content similarity (if available)
    const content1 = this.createContentFingerprint(article1)
    const content2 = this.createContentFingerprint(article2)

    const contentSimilarity = content1 && content2
      ? this.calculateStringSimilarity(content1, content2)
      : 0

    // URL similarity (same article from different sources)
    const urlSimilarity = this.calculateURLSimilarity(article1.url, article2.url)

    // Weighted similarity calculation
    const weights = {
      title: 0.6,
      content: 0.3,
      url: 0.1
    }

    return (
      titleSimilarity * weights.title +
      contentSimilarity * weights.content +
      urlSimilarity * weights.url
    )
  }

  // Calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (str1.length === 0 || str2.length === 0) return 0.0

    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    const editDistance = this.levenshteinDistance(longer, shorter)

    return (longer.length - editDistance) / longer.length
  }

  // Calculate Levenshtein distance
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Calculate URL similarity
  private calculateURLSimilarity(url1: string, url2: string): number {
    try {
      const u1 = new URL(url1)
      const u2 = new URL(url2)

      // Same domain
      if (u1.hostname === u2.hostname) {
        // Same path (very likely same article)
        if (u1.pathname === u2.pathname) {
          return 1.0
        }

        // Similar paths
        const path1 = u1.pathname.split('/').filter(Boolean)
        const path2 = u2.pathname.split('/').filter(Boolean)

        const commonSegments = path1.filter(segment => path2.includes(segment))
        const similarity = commonSegments.length / Math.max(path1.length, path2.length)

        return similarity * 0.8
      }
    } catch {
      // Invalid URLs
      return 0
    }

    return 0
  }

  // Add article to processed list
  async addProcessedArticle(article: NewsArticle): Promise<void> {
    try {
      const articles = await this.loadArticles()
      const hash = this.generateArticleHash(article)

      const existing = articles.get(hash)

      if (existing) {
        // Update existing record
        existing.lastSeen = new Date().toISOString()
        existing.timesProcessed++

        if (!existing.sources.includes(article.source)) {
          existing.sources.push(article.source)
        }
      } else {
        // Add new record
        const processed: ProcessedArticle = {
          ...article,
          hash,
          processedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          timesProcessed: 1,
          sources: [article.source]
        }

        articles.set(hash, processed)
      }

      await this.saveArticles(articles)
    } catch (error) {
      console.error('Failed to add processed article:', error)
      throw error
    }
  }

  // Filter out duplicate articles
  async filterDuplicates(articles: NewsArticle[], options?: {
    titleSimilarity?: number
    contentSimilarity?: number
    timeWindow?: number
  }): Promise<{
    uniqueArticles: NewsArticle[]
    duplicates: Array<{
      article: NewsArticle
      similarity: number
      reason: string
      existingArticle?: ProcessedArticle
    }>
  }> {
    const uniqueArticles: NewsArticle[] = []
    const duplicates = []

    for (const article of articles) {
      const duplicateCheck = await this.isDuplicate(article, options)

      if (duplicateCheck.isDuplicate) {
        duplicates.push({
          article,
          similarity: duplicateCheck.similarity,
          reason: duplicateCheck.reason,
          existingArticle: duplicateCheck.existingArticle
        })
      } else {
        uniqueArticles.push(article)
      }
    }

    return {
      uniqueArticles,
      duplicates
    }
  }

  // Get statistics
  async getStats(): Promise<{
    totalProcessed: number
    duplicatesDetected: number
    uniqueSources: string[]
    averageTimesProcessed: number
    recentActivity: Array<{ date: string; count: number }>
  }> {
    try {
      const articles = await this.loadArticles()
      const now = new Date()
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        totalProcessed: articles.size,
        duplicatesDetected: 0,
        uniqueSources: new Set<string>(),
        averageTimesProcessed: 0,
        recentActivity: [] as Array<{ date: string; count: number }>
      }

      let totalProcessedCount = 0
      const dailyActivity = new Map<string, number>()

      for (const article of articles.values()) {
        // Count duplicates (timesProcessed > 1)
        if (article.timesProcessed > 1) {
          stats.duplicatesDetected += article.timesProcessed - 1
        }

        // Collect unique sources
        article.sources.forEach(source => stats.uniqueSources.add(source))

        // Count total processing
        totalProcessedCount += article.timesProcessed

        // Daily activity for last week
        const processDate = new Date(article.processedAt).toISOString().split('T')[0]
        if (new Date(article.processedAt) >= lastWeek) {
          dailyActivity.set(processDate, (dailyActivity.get(processDate) || 0) + 1)
        }
      }

      stats.averageTimesProcessed = stats.totalProcessed > 0
        ? totalProcessedCount / stats.totalProcessed
        : 0

      // Sort daily activity
      stats.recentActivity = Array.from(dailyActivity.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        ...stats,
        uniqueSources: Array.from(stats.uniqueSources)
      }

    } catch (error) {
      console.error('Failed to get duplicate detection stats:', error)
      throw error
    }
  }

  // Cleanup old articles
  async cleanup(olderThanDays: number = 30): Promise<number> {
    try {
      const articles = await this.loadArticles()
      const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

      let cleanedCount = 0

      for (const [hash, article] of articles) {
        if (new Date(article.lastSeen) < cutoffTime) {
          articles.delete(hash)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        await this.saveArticles(articles)
        console.log(`Cleaned up ${cleanedCount} old articles from duplicate detection`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Failed to cleanup duplicate detection data:', error)
      throw error
    }
  }
}

// Export singleton instance
export const newsDuplicateDetector = new NewsDuplicateDetector()

// Helper functions
export async function checkAndFilterNewsArticles(
  articles: NewsArticle[],
  options?: {
    titleSimilarity?: number
    contentSimilarity?: number
    timeWindow?: number
  }
): Promise<{
  uniqueArticles: NewsArticle[]
  duplicates: Array<{
    article: NewsArticle
    similarity: number
    reason: string
    existingArticle?: ProcessedArticle
  }>
}> {
  return await newsDuplicateDetector.filterDuplicates(articles, options)
}

export async function markNewsArticlesProcessed(articles: NewsArticle[]): Promise<void> {
  for (const article of articles) {
    await newsDuplicateDetector.addProcessedArticle(article)
  }
}