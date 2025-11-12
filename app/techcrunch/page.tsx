"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import type { TechCrunchArticle } from "@/lib/types"
import { Search, RefreshCw, ExternalLink, Clock, User, MessageSquare, Calendar, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"

export default function TechCrunchPage() {
  const [articles, setArticles] = useState<TechCrunchArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("24")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [generatingTweets, setGeneratingTweets] = useState<Set<string>>(new Set())
  const [rejectingArticles, setRejectingArticles] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // Fetch articles on page load
  useEffect(() => {
    fetchTechCrunchArticles(true)
  }, [timeRange])

  // Get unique categories
  const allCategories = Array.from(new Set(articles.flatMap(article => article.categories))).sort()

  const filteredArticles = articles
    .filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "all" || article.categories.includes(categoryFilter)
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  const fetchTechCrunchArticles = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const response = await fetch(`/api/techcrunch/fetch-articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          hours: parseInt(timeRange)
        })
      })

      const data = await response.json()

      if (response.ok) {
        setArticles(data.articles)
        toast({
          title: "Articles updated",
          description: `Fetched ${data.articles.length} articles from TechCrunch (last ${timeRange} hours).`,
        })
      } else {
        if (response.status === 401) {
          throw new Error("Authentication required. Please refresh the page and log in again.")
        } else {
          throw new Error(data.error || "Failed to fetch articles")
        }
      }
    } catch (error) {
      console.error("TechCrunch fetch error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch articles. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRejectArticle = async (article: TechCrunchArticle) => {
    setRejectingArticles((prev) => new Set(prev).add(article.id))
    try {
      const response = await fetch(`/api/techcrunch/reject-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ article })
      })

      const data = await response.json()

      if (response.ok) {
        // Remove the article from the list
        setArticles(prev => prev.filter(a => a.id !== article.id))
        toast({
          title: "Article rejected",
          description: `Article "${article.title}" has been rejected and won't appear again.`,
        })
      } else {
        throw new Error(data.error || "Failed to reject article")
      }
    } catch (error) {
      console.error("Reject article error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject article. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRejectingArticles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(article.id)
        return newSet
      })
    }
  }

  const handleRefresh = () => {
    fetchTechCrunchArticles(false)
  }

  const handleGenerateTweet = async (article: TechCrunchArticle) => {
    setGeneratingTweets((prev) => new Set(prev).add(article.id))
    try {
      const response = await fetch(`/api/tweets/generate-from-techcrunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ article })
      })

      const data = await response.json()

      if (response.ok) {
        // Save the generated tweet to pending list
        const saveResponse = await fetch(`/api/tweets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({
            action: "save",
            content: data.tweet,
            source: "techcrunch",
            sourceUrl: article.url,
            sourceTitle: article.title,
            aiScore: data.aiScore,
            status: "pending"
          })
        })

        if (saveResponse.ok) {
          toast({
            title: "Tweet generated and saved!",
            description: `Created a tweet for "${article.title}" and added to pending tweets.`,
          })
        } else {
          toast({
            title: "Tweet generated but save failed",
            description: `Generated tweet for "${article.title}" but couldn't save it.`,
            variant: "destructive",
          })
        }
      } else {
        throw new Error(data.error || "Failed to generate tweet")
      }
    } catch (error) {
      console.error("TechCrunch tweet generation error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate tweet. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingTweets((prev) => {
        const newSet = new Set(prev)
        newSet.delete(article.id)
        return newSet
      })
    }
  }

  const totalArticles = articles.length
  const totalCategories = allCategories.length

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">TechCrunch News</h1>
              <p className="text-muted-foreground mt-2">Latest tech news and trends from TechCrunch</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Total Articles</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{totalArticles}</div>
            </div>
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Categories</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{totalCategories}</div>
            </div>
            <div className="p-4 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Time Range</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{timeRange}h</div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Categories:</span>
            {allCategories.map((category) => (
              <Badge key={category} variant="outline" className="text-primary border-primary/20">
                {category}
              </Badge>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Article List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading TechCrunch articles...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-12">
                <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No articles found matching your criteria.</p>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <Card key={article.id} className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground truncate">{article.title}</h3>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{article.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{article.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        {article.categories.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {article.categories.slice(0, 3).map((category) => (
                              <Badge key={category} variant="secondary" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                            {article.categories.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{article.categories.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleGenerateTweet(article)}
                            disabled={generatingTweets.has(article.id)}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {generatingTweets.has(article.id) ? "Generating..." : "Generate Tweet"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectArticle(article)}
                            disabled={rejectingArticles.has(article.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            {rejectingArticles.has(article.id) ? "Rejecting..." : "Reject"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  {article.imageUrl && (
                    <CardContent className="pt-0">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-48 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}