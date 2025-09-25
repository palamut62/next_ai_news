import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

interface RejectedArticle {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  description?: string
  rejectedAt: string
  reason?: string
}

class RejectedArticlesTracker {
  private readonly REJECTED_FILE: string
  private rejectedCache: Map<string, RejectedArticle> = new Map()
  private lastCacheUpdate = 0
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  constructor() {
    // Use temporary directory for Vercel compatibility
    const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')
    this.REJECTED_FILE = path.join(tmpDir, 'rejected-articles.json')
  }

  private async ensureDataDirectory(): Promise<void> {
    const tmpDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data')
    try {
      await fs.access(tmpDir)
    } catch {
      await fs.mkdir(tmpDir, { recursive: true })
    }
  }

  async loadRejectedArticles(): Promise<Map<string, RejectedArticle>> {
    try {
      // Use cache if still valid
      if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL && this.rejectedCache.size > 0) {
        return this.rejectedCache
      }

      await this.ensureDataDirectory()
      const data = await fs.readFile(this.REJECTED_FILE, 'utf-8')
      const articles: RejectedArticle[] = JSON.parse(data)

      this.rejectedCache = new Map(articles.map(article => [article.id, article]))
      this.lastCacheUpdate = Date.now()

      return this.rejectedCache
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return new Map()
      }
      throw error
    }
  }

  async saveRejectedArticles(articles: Map<string, RejectedArticle>): Promise<void> {
    try {
      await this.ensureDataDirectory()
      const data = Array.from(articles.values())
      await fs.writeFile(this.REJECTED_FILE, JSON.stringify(data, null, 2))

      // Update cache
      this.rejectedCache = articles
      this.lastCacheUpdate = Date.now()
    } catch (error) {
      console.error('Failed to save rejected articles:', error)
      throw error
    }
  }

  // Generate a unique ID for the article
  generateArticleId(article: { title: string; url: string; source: string }): string {
    const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    const urlDomain = new URL(article.url).hostname.replace('www.', '')
    const combinedData = `${normalizedTitle}|${urlDomain}|${article.source}`
    return crypto.createHash('sha256').update(combinedData).digest('hex').substring(0, 16)
  }

  // Check if an article is rejected
  async isRejected(article: { title: string; url: string; source: string }): Promise<boolean> {
    try {
      const rejectedArticles = await this.loadRejectedArticles()
      const articleId = this.generateArticleId(article)
      return rejectedArticles.has(articleId)
    } catch (error) {
      console.error('Error checking if article is rejected:', error)
      return false
    }
  }

  // Add article to rejected list
  async addRejectedArticle(article: {
    title: string
    url: string
    source: string
    publishedAt: string
    description?: string
    reason?: string
  }): Promise<void> {
    try {
      const rejectedArticles = await this.loadRejectedArticles()
      const articleId = this.generateArticleId(article)

      if (!rejectedArticles.has(articleId)) {
        const rejectedArticle: RejectedArticle = {
          id: articleId,
          ...article,
          rejectedAt: new Date().toISOString()
        }

        rejectedArticles.set(articleId, rejectedArticle)
        await this.saveRejectedArticles(rejectedArticles)
        console.log(`Article rejected: "${article.title.substring(0, 50)}..."`)
      }
    } catch (error) {
      console.error('Failed to add rejected article:', error)
      throw error
    }
  }

  // Filter out rejected articles
  async filterRejectedArticles(articles: any[]): Promise<{ articles: any[]; rejectedCount: number }> {
    try {
      const rejectedArticles = await this.loadRejectedArticles()
      const filteredArticles: any[] = []
      let rejectedCount = 0

      for (const article of articles) {
        const articleId = this.generateArticleId({
          title: article.title,
          url: article.url,
          source: article.source || 'techcrunch'
        })

        if (!rejectedArticles.has(articleId)) {
          filteredArticles.push(article)
        } else {
          rejectedCount++
        }
      }

      return { articles: filteredArticles, rejectedCount }
    } catch (error) {
      console.error('Error filtering rejected articles:', error)
      return { articles, rejectedCount: 0 }
    }
  }

  // Get statistics
  async getStats(): Promise<{
    totalRejected: number
    recentRejections: Array<{ date: string; count: number }>
    topSources: Array<{ source: string; count: number }>
  }> {
    try {
      const rejectedArticles = await this.loadRejectedArticles()
      const now = new Date()
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        totalRejected: rejectedArticles.size,
        recentRejections: [] as Array<{ date: string; count: number }>,
        topSources: new Map<string, number>()
      }

      const dailyRejections = new Map<string, number>()

      for (const article of rejectedArticles.values()) {
        // Daily activity for last week
        const rejectionDate = new Date(article.rejectedAt).toISOString().split('T')[0]
        if (new Date(article.rejectedAt) >= lastWeek) {
          dailyRejections.set(rejectionDate, (dailyRejections.get(rejectionDate) || 0) + 1)
        }

        // Count by source
        stats.topSources.set(article.source, (stats.topSources.get(article.source) || 0) + 1)
      }

      // Sort daily activity
      stats.recentRejections = Array.from(dailyRejections.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        ...stats,
        topSources: Array.from(stats.topSources.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
      }

    } catch (error) {
      console.error('Failed to get rejected articles stats:', error)
      throw error
    }
  }

  // Cleanup old rejected articles
  async cleanup(olderThanDays: number = 90): Promise<number> {
    try {
      const rejectedArticles = await this.loadRejectedArticles()
      const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

      let cleanedCount = 0

      for (const [id, article] of rejectedArticles) {
        if (new Date(article.rejectedAt) < cutoffTime) {
          rejectedArticles.delete(id)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        await this.saveRejectedArticles(rejectedArticles)
        console.log(`Cleaned up ${cleanedCount} old rejected articles`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Failed to cleanup rejected articles:', error)
      throw error
    }
  }
}

// Export singleton instance
export const rejectedArticlesTracker = new RejectedArticlesTracker()

// Helper functions
export async function filterRejectedArticles(articles: any[]): Promise<{ articles: any[]; rejectedCount: number }> {
  return await rejectedArticlesTracker.filterRejectedArticles(articles)
}

export async function addRejectedArticle(article: {
  title: string
  url: string
  source: string
  publishedAt: string
  description?: string
  reason?: string
}): Promise<void> {
  await rejectedArticlesTracker.addRejectedArticle(article)
}

export async function isArticleRejected(article: { title: string; url: string; source: string }): Promise<boolean> {
  return await rejectedArticlesTracker.isRejected(article)
}