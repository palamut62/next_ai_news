import crypto from 'crypto'
import { db } from './firebase'
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'

interface RejectedGitHubRepo {
  id: string
  name: string
  url: string
  fullName: string
  description?: string
  language?: string
  stars: number
  rejectedAt: string
  reason?: string
}

class RejectedGitHubReposTracker {
  private rejectedCache: Map<string, RejectedGitHubRepo> = new Map()
  private lastCacheUpdate = 0
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  async loadRejectedRepos(): Promise<Map<string, RejectedGitHubRepo>> {
    try {
      // Use cache if still valid
      if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL && this.rejectedCache.size > 0) {
        return this.rejectedCache
      }

      if (!db) {
        console.warn('Firebase not initialized')
        return new Map()
      }

      const reposRef = collection(db, 'rejected_github_repos')
      const snapshot = await getDocs(reposRef)

      this.rejectedCache = new Map()
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        this.rejectedCache.set(data.id, {
          id: data.id,
          name: data.name,
          url: data.url,
          fullName: data.fullName,
          description: data.description,
          language: data.language,
          stars: data.stars,
          rejectedAt: data.rejectedAt,
          reason: data.reason,
        } as RejectedGitHubRepo)
      })

      this.lastCacheUpdate = Date.now()
      return this.rejectedCache
    } catch (error) {
      console.error('Failed to load rejected GitHub repos from Firebase:', error)
      return new Map()
    }
  }

  async saveRejectedRepos(repos: Map<string, RejectedGitHubRepo>): Promise<void> {
    try {
      if (!db) {
        console.warn('Firebase not initialized, skipping save')
        return
      }

      // Update cache
      this.rejectedCache = repos
      this.lastCacheUpdate = Date.now()
    } catch (error) {
      console.error('Failed to save rejected GitHub repos:', error)
    }
  }

  // Generate a unique ID for the repository
  generateRepoId(repo: { fullName: string; url: string }): string {
    const normalizedFullName = repo.fullName.toLowerCase()
    const urlDomain = new URL(repo.url).hostname.replace('www.', '')
    const combinedData = `${normalizedFullName}|${urlDomain}`
    return crypto.createHash('sha256').update(combinedData).digest('hex').substring(0, 16)
  }

  // Check if a repository is rejected
  async isRejected(repo: { fullName: string; url: string }): Promise<boolean> {
    try {
      const rejectedRepos = await this.loadRejectedRepos()
      const repoId = this.generateRepoId(repo)
      return rejectedRepos.has(repoId)
    } catch (error) {
      console.error('Error checking if repo is rejected:', error)
      return false
    }
  }

  // Add repository to rejected list
  async addRejectedRepo(repo: {
    fullName: string
    url: string
    name: string
    description?: string
    language?: string
    stars: number
    reason?: string
  }): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const rejectedRepos = await this.loadRejectedRepos()
      const repoId = this.generateRepoId(repo)

      if (!rejectedRepos.has(repoId)) {
        const rejectedRepo: any = {
          id: repoId,
          ...repo,
          rejectedAt: new Date().toISOString(),
          createdAt: Timestamp.now(),
        }

        const reposRef = collection(db, 'rejected_github_repos')
        await addDoc(reposRef, rejectedRepo)

        rejectedRepos.set(repoId, rejectedRepo)
        await this.saveRejectedRepos(rejectedRepos)
        console.log(`GitHub repository rejected: "${repo.fullName}"`)
      }
    } catch (error) {
      console.error('Failed to add rejected GitHub repo:', error)
      throw error
    }
  }

  // Filter out rejected repositories
  async filterRejectedRepos(repos: any[]): Promise<{ repos: any[]; rejectedCount: number }> {
    try {
      const rejectedRepos = await this.loadRejectedRepos()
      const filteredRepos: any[] = []
      let rejectedCount = 0

      for (const repo of repos) {
        const repoId = this.generateRepoId({
          fullName: repo.fullName,
          url: repo.url,
        })

        if (!rejectedRepos.has(repoId)) {
          filteredRepos.push(repo)
        } else {
          rejectedCount++
        }
      }

      return { repos: filteredRepos, rejectedCount }
    } catch (error) {
      console.error('Error filtering rejected GitHub repos:', error)
      return { repos, rejectedCount: 0 }
    }
  }

  // Get statistics
  async getStats(): Promise<{
    totalRejected: number
    recentRejections: Array<{ date: string; count: number }>
    topLanguages: Array<{ language: string; count: number }>
  }> {
    try {
      const rejectedRepos = await this.loadRejectedRepos()
      const now = new Date()
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const stats = {
        totalRejected: rejectedRepos.size,
        recentRejections: [] as Array<{ date: string; count: number }>,
        topLanguages: new Map<string, number>(),
      }

      const dailyRejections = new Map<string, number>()

      for (const repo of rejectedRepos.values()) {
        // Daily activity for last week
        const rejectionDate = new Date(repo.rejectedAt).toISOString().split('T')[0]
        if (new Date(repo.rejectedAt) >= lastWeek) {
          dailyRejections.set(rejectionDate, (dailyRejections.get(rejectionDate) || 0) + 1)
        }

        // Count by language
        const language = repo.language || 'Unknown'
        stats.topLanguages.set(language, (stats.topLanguages.get(language) || 0) + 1)
      }

      // Sort daily activity
      stats.recentRejections = Array.from(dailyRejections.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        ...stats,
        topLanguages: Array.from(stats.topLanguages.entries())
          .map(([language, count]) => ({ language, count }))
          .sort((a, b) => b.count - a.count),
      }
    } catch (error) {
      console.error('Failed to get rejected GitHub repos stats:', error)
      throw error
    }
  }

  // Cleanup old rejected repositories
  async cleanup(olderThanDays: number = 90): Promise<number> {
    try {
      if (!db) {
        return 0
      }

      const rejectedRepos = await this.loadRejectedRepos()
      const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

      let cleanedCount = 0
      const reposRef = collection(db, 'rejected_github_repos')
      const snapshot = await getDocs(reposRef)

      for (const docSnapshot of snapshot.docs) {
        const repo = docSnapshot.data()
        if (new Date(repo.rejectedAt) < cutoffTime) {
          await deleteDoc(doc(db, 'rejected_github_repos', docSnapshot.id))
          rejectedRepos.delete(repo.id)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        await this.saveRejectedRepos(rejectedRepos)
        console.log(`Cleaned up ${cleanedCount} old rejected GitHub repositories`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Failed to cleanup rejected GitHub repos:', error)
      throw error
    }
  }
}

// Export singleton instance
export const rejectedGitHubReposTracker = new RejectedGitHubReposTracker()

// Helper functions
export async function filterRejectedGitHubRepos(repos: any[]): Promise<{ repos: any[]; rejectedCount: number }> {
  return await rejectedGitHubReposTracker.filterRejectedRepos(repos)
}

export async function addRejectedGitHubRepo(repo: {
  fullName: string
  url: string
  name: string
  description?: string
  language?: string
  stars: number
  reason?: string
}): Promise<void> {
  await rejectedGitHubReposTracker.addRejectedRepo(repo)
}

export async function isGitHubRepoRejected(repo: { fullName: string; url: string }): Promise<boolean> {
  return await rejectedGitHubReposTracker.isRejected(repo)
}
