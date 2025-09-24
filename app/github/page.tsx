"use client"

import { useState } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { RepoCard } from "@/components/repo-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { GitHubRepo } from "@/lib/types"
import { Search, RefreshCw, Github, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Mock data - in a real app this would come from GitHub API
const mockRepos: GitHubRepo[] = [
  {
    id: "1",
    name: "neural-search",
    fullName: "awesome-dev/neural-search",
    description:
      "A blazing fast semantic search engine built with Rust and modern ML techniques. Perfect for developers looking to add intelligent search to their applications.",
    stars: 15420,
    forks: 892,
    language: "Rust",
    url: "https://github.com/awesome-dev/neural-search",
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    name: "react-flow-builder",
    fullName: "ui-libs/react-flow-builder",
    description:
      "Visual flow builder for React applications. Create complex workflows with drag-and-drop interface and real-time collaboration features.",
    stars: 8934,
    forks: 567,
    language: "TypeScript",
    url: "https://github.com/ui-libs/react-flow-builder",
    updatedAt: "2024-01-15T08:45:00Z",
  },
  {
    id: "3",
    name: "ai-code-reviewer",
    fullName: "devtools/ai-code-reviewer",
    description:
      "AI-powered code review assistant that provides intelligent suggestions and catches potential bugs before they reach production.",
    stars: 12567,
    forks: 1234,
    language: "Python",
    url: "https://github.com/devtools/ai-code-reviewer",
    updatedAt: "2024-01-15T07:20:00Z",
  },
  {
    id: "4",
    name: "micro-frontend-toolkit",
    fullName: "architecture/micro-frontend-toolkit",
    description:
      "Complete toolkit for building and managing micro-frontend architectures. Includes routing, state management, and deployment tools.",
    stars: 6789,
    forks: 445,
    language: "JavaScript",
    url: "https://github.com/architecture/micro-frontend-toolkit",
    updatedAt: "2024-01-14T16:15:00Z",
  },
  {
    id: "5",
    name: "quantum-simulator",
    fullName: "quantum-computing/quantum-simulator",
    description:
      "High-performance quantum computing simulator with visualization tools. Great for learning quantum algorithms and testing quantum circuits.",
    stars: 4321,
    forks: 234,
    language: "C++",
    url: "https://github.com/quantum-computing/quantum-simulator",
    updatedAt: "2024-01-14T14:30:00Z",
  },
  {
    id: "6",
    name: "blockchain-analytics",
    fullName: "crypto-tools/blockchain-analytics",
    description:
      "Advanced blockchain analytics platform with real-time transaction monitoring, wallet tracking, and DeFi protocol analysis.",
    stars: 9876,
    forks: 678,
    language: "Go",
    url: "https://github.com/crypto-tools/blockchain-analytics",
    updatedAt: "2024-01-14T12:45:00Z",
  },
]

export default function GitHubPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>(mockRepos)
  const [searchQuery, setSearchQuery] = useState("")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("stars")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [generatingTweets, setGeneratingTweets] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const languages = Array.from(new Set(repos.map((repo) => repo.language))).sort()

  const filteredRepos = repos
    .filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesLanguage = languageFilter === "all" || repo.language === languageFilter
      return matchesSearch && matchesLanguage
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "stars":
          return b.stars - a.stars
        case "forks":
          return b.forks - a.forks
        case "updated":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        default:
          return 0
      }
    })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // In a real app, this would fetch from GitHub API
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast({
        title: "Repositories updated",
        description: "Fetched latest trending repositories from GitHub.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch repositories. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleGenerateTweet = async (repo: GitHubRepo) => {
    setGeneratingTweets((prev) => new Set(prev).add(repo.id))
    try {
      // In a real app, this would call your AI service to generate a tweet
      await new Promise((resolve) => setTimeout(resolve, 3000))
      toast({
        title: "Tweet generated",
        description: `Created a new tweet for ${repo.name}. Check pending tweets to review.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tweet. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingTweets((prev) => {
        const newSet = new Set(prev)
        newSet.delete(repo.id)
        return newSet
      })
    }
  }

  const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0)
  const avgStars = Math.round(totalStars / repos.length)

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">GitHub Integration</h1>
              <p className="text-muted-foreground mt-2">Discover trending repositories and generate tweets</p>
            </div>
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Github className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Repos</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{repos.length}</div>
            </div>
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Stars</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{totalStars.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Avg Stars</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{avgStars.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Github className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Languages</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{languages.length}</div>
            </div>
          </div>

          {/* Language Distribution */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Languages:</span>
            {languages.map((language) => {
              const count = repos.filter((repo) => repo.language === language).length
              return (
                <Badge key={language} variant="outline" className="text-primary border-primary/20">
                  {language} ({count})
                </Badge>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">Most Stars</SelectItem>
                <SelectItem value="forks">Most Forks</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Repository List */}
          <div className="space-y-4">
            {filteredRepos.length === 0 ? (
              <div className="text-center py-12">
                <Github className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No repositories found matching your criteria.</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  onGenerateTweet={handleGenerateTweet}
                  isGenerating={generatingTweets.has(repo.id)}
                />
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
