export interface Tweet {
  id: string
  content: string
  source: string
  sourceUrl: string
  sourceTitle: string
  aiScore: number
  status: "pending" | "approved" | "rejected" | "posted"
  createdAt: string
  newsDate?: string
  scheduledAt?: string
  postedAt?: string
  rejectedAt?: string
  twitterId?: string
  postError?: string | null
  engagement?: {
    likes: number
    retweets: number
    replies: number
  }
}

export interface Article {
  id: string
  title: string
  url: string
  summary: string
  publishedAt: string
  category: string
}

export interface TechCrunchArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  publishedAt: string
  author: string
  categories: string[]
  imageUrl?: string
  aiScore?: number
}

export interface GitHubRepo {
  id: string
  name: string
  fullName: string
  description: string
  stars: number
  forks: number
  language: string
  url: string
  updatedAt: string
}

export interface Settings {
  automation: {
    enabled: boolean
    checkInterval: number // hours
    maxArticlesPerCheck: number
    minAiScore: number
    autoPost: boolean
    requireApproval: boolean
    rateLimitDelay: number // seconds
  }
  github: {
    enabled: boolean
    languages: string[]
    timeRange: "daily" | "weekly" | "monthly"
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
    provider: "gemini" | "openai" | "claude"
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
  }
  apiUrl: string
}

export interface Notification {
  id: string
  type:
    | "tweet_created"
    | "tweet_posted"
    | "tweet_approved"
    | "tweet_rejected"
    | "system_error"
    | "github_repo_found"
    | "automation_paused"
    | "automation_resumed"
  title: string
  message: string
  timestamp: string
  read: boolean
  severity: "info" | "success" | "warning" | "error"
  metadata?: {
    tweetId?: string
    repoId?: string
    errorCode?: string
    [key: string]: any
  }
}
