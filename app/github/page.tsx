"use client"

import { useState, useEffect } from "react"
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

export default function GitHubPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("stars")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [generatingTweets, setGeneratingTweets] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // Fetch repositories on page load
  useEffect(() => {
    fetchGitHubRepos(true)
  }, [])

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

  const fetchGitHubRepos = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/github/fetch-repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          count: 20
        })
      })

      const data = await response.json()

      if (response.ok) {
        setRepos(data.repos)
        const filterInfo = data.filters ?
          ` (filtered ${data.filters.duplicatesRemoved} duplicates from ${data.filters.totalProcessed} total)` :
          ''
        toast({
          title: "Repositories updated",
          description: `Fetched ${data.repos.length} trending repositories from GitHub${filterInfo}.`,
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch repositories. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchGitHubRepos(false)
  }

  const handleGenerateTweet = async (repo: GitHubRepo) => {
    setGeneratingTweets((prev) => new Set(prev).add(repo.id))
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/tweets/generate-from-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repo })
      })

      const data = await response.json()

      if (response.ok) {
        // Save the generated tweet to pending list
        const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/tweets/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: data.tweet,
            source: "github",
            sourceUrl: repo.url,
            sourceTitle: repo.name,
            aiScore: data.aiScore,
            status: "pending"
          })
        })

        if (saveResponse.ok) {
          toast({
            title: "Tweet generated and saved!",
            description: `Created a tweet for ${repo.name} and added to pending tweets.`,
          })
        } else {
          toast({
            title: "Tweet generated but save failed",
            description: `Generated tweet for ${repo.name} but couldn't save it.`,
            variant: "destructive",
          })
        }
      } else {
        throw new Error(data.error || "Failed to generate tweet")
      }
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
  const avgStars = repos.length > 0 ? Math.round(totalStars / repos.length) : 0

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
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading trending repositories...</p>
              </div>
            ) : filteredRepos.length === 0 ? (
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
