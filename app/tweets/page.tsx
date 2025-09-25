"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TweetCard } from "@/components/tweet-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { Tweet } from "@/lib/types"
import { Search, RefreshCw, CheckCircle, X, Send, Settings, Newspaper, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TweetsPage() {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetchingNews, setIsFetchingNews] = useState(false)
  const [isTestingNews, setIsTestingNews] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [selectedTweets, setSelectedTweets] = useState<string[]>([])
  const [autoPost, setAutoPost] = useState(true)
  const [bulkActionsVisible, setBulkActionsVisible] = useState(false)
  const { toast } = useToast()

  const fetchTweets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (sourceFilter !== "all") params.append("source", sourceFilter)

      const response = await fetch(`/api/tweets?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTweets(data)
      }
    } catch (error) {
      console.error("Failed to fetch tweets:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load autoPost setting from server-side settings.json on mount only
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings', { credentials: 'same-origin' })
        if (!res.ok) return
        const settings = await res.json()
        if (mounted && settings?.automation?.autoPost !== undefined) {
          setAutoPost(Boolean(settings.automation.autoPost))
        }
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  // Handle autoPost toggle with server-side persistence
  const handleAutoPostToggle = async (checked: boolean) => {
    setAutoPost(checked)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation: { autoPost: checked } }),
      })

      if (!res.ok) {
        console.error('Failed to save autoPost setting')
        // Revert on failure
        setAutoPost(!checked)
      }
    } catch (e) {
      console.error('Error saving autoPost setting:', e)
      // Revert on failure
      setAutoPost(!checked)
    }
  }

  const fetchAiNews = async () => {
    setIsFetchingNews(true)
    try {
      const response = await fetch('/api/news/process-news-tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      })

      const data = await response.json()

      if (response.ok) {
        // Show success message and refresh tweets
        toast({
          title: "AI News Fetched Successfully! 🎉",
          description: `Processed ${data.articlesFound} articles and generated ${data.tweetsSaved} tweets.`,
        })
        fetchTweets()
      } else {
        toast({
          title: "Failed to Fetch AI News",
          description: data.message || "An error occurred while fetching news.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch AI news:", error)
      toast({
        title: "Network Error",
        description: "Failed to fetch AI news. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setIsFetchingNews(false)
    }
  }

  useEffect(() => {
    fetchTweets()
  }, [statusFilter, sourceFilter])

  const filteredTweets = tweets.filter((tweet) => {
    const matchesSearch =
      tweet.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tweet.sourceTitle.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  const handleApprove = async (id: string) => {
    try {
      // Find the tweet data
      const tweetData = tweets.find(tweet => tweet.id === id)

      if (!tweetData) {
        toast({
          title: "Error",
          description: "Tweet data not found",
          variant: "destructive",
        })
        return
      }

  const response = await fetch('/api/tweets/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetIds: [id],
          autoPost: autoPost,
          tweets: [tweetData]
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Tweet Approved",
          description: autoPost ? "Tweet approved and posted to Twitter!" : "Tweet approved successfully",
        })
        fetchTweets()
  } else {
        toast({
          title: "Approval Failed",
          description: data.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to approve tweet:", error)
      toast({
        title: "Network Error",
        description: "Failed to approve tweet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', tweetId: id })
      })

      if (response.ok) {
        fetchTweets()
        toast({
          title: 'Tweet Rejected',
          description: 'The tweet was permanently deleted.',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Rejection Failed',
          description: error.error || 'Failed to delete tweet',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error("Failed to reject tweet:", error)
      toast({
        title: 'Network Error',
        description: 'Failed to reject tweet. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', tweetId: id })
      })

      if (response.ok) {
        fetchTweets()
      }
    } catch (error) {
      console.error("Failed to delete tweet:", error)
    }
  }

  const handleSelectTweet = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTweets([...selectedTweets, id])
    } else {
      setSelectedTweets(selectedTweets.filter((tweetId) => tweetId !== id))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingTweetIds = filteredTweets.filter(t => t.status === 'pending').map(t => t.id)
      setSelectedTweets(pendingTweetIds)
    } else {
      setSelectedTweets([])
    }
  }

  const handleBulkApprove = async () => {
    try {
      // Find the full tweet data for selected tweets
      const selectedTweetData = tweets.filter(tweet => selectedTweets.includes(tweet.id))

      const response = await fetch('/api/tweets/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetIds: selectedTweets,
          autoPost: autoPost,
          tweets: selectedTweetData
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Bulk Approval Successful",
          description: data.message,
        })
        setSelectedTweets([])
        setBulkActionsVisible(false)
        fetchTweets()
      } else {
        toast({
          title: "Bulk Approval Failed",
          description: data.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to bulk approve tweets:", error)
      toast({
        title: "Network Error",
        description: "Failed to bulk approve tweets. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkReject = async () => {
    try {
      const response = await fetch('/api/tweets/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetIds: selectedTweets })
      })

      if (response.ok) {
        const data = await response.json()
        // After bulk reject, switch to rejected view so the rejected items are visible
        // and removed from the pending list.
        setSelectedTweets([])
        setBulkActionsVisible(false)
        setStatusFilter('rejected')
        fetchTweets()
        toast({
          title: "Bulk Rejection Successful",
          description: `${data.rejectedCount || selectedTweets.length} tweets rejected and stored for duplicate checking`,
        })
      } else {
        const error = await response.json()
        toast({
          title: "Bulk Rejection Failed",
          description: error.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to bulk reject tweets:", error)
      toast({
        title: "Network Error",
        description: "Failed to bulk reject tweets. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkPost = async () => {
    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', tweetIds: selectedTweets })
      })

      if (response.ok) {
        setSelectedTweets([])
        setBulkActionsVisible(false)
        fetchTweets()
      }
    } catch (error) {
      console.error("Failed to bulk post tweets:", error)
    }
  }

  const testRealNews = async () => {
    setIsTestingNews(true)
    try {
      const response = await fetch('/api/news/test-real-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 3 })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "News API Test Successful! 🎉",
          description: `Found ${data.articlesFound} real articles. API key is working!`,
        })
      } else {
        toast({
          title: "News API Test Failed",
          description: data.message || "API test failed",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to test real news:", error)
      toast({
        title: "Network Error",
        description: "Failed to test News API. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsTestingNews(false)
    }
  }

  const statusCounts = {
    pending: tweets.filter((t) => t.status === "pending").length,
    approved: tweets.filter((t) => t.status === "approved").length,
    posted: tweets.filter((t) => t.status === "posted").length,
    rejected: tweets.filter((t) => t.status === "rejected").length,
  }

  const pendingTweets = filteredTweets.filter(t => t.status === 'pending')
  const approvedTweets = filteredTweets.filter(t => t.status === 'approved')
  const allPendingSelected = pendingTweets.length > 0 && pendingTweets.every(t => selectedTweets.includes(t.id))

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tweet Management</h1>
              <p className="text-muted-foreground mt-1 md:mt-2">Review and manage AI-generated tweets</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center justify-center space-x-2">
                <Switch
                  id="auto-post"
                  checked={autoPost}
                  onCheckedChange={handleAutoPostToggle}
                />
                <Label htmlFor="auto-post" className="text-sm">
                  Auto-post
                </Label>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={fetchAiNews}
                  disabled={isFetchingNews || loading}
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm"
                  size="sm"
                >
                  <Newspaper className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${isFetchingNews ? 'animate-pulse' : ''}`} />
                  <Download className={`h-2 w-2 sm:h-3 sm:w-3 mr-1 ${isFetchingNews ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">{isFetchingNews ? 'Fetching News...' : 'Fetch AI News'}</span>
                  <span className="sm:hidden">{isFetchingNews ? 'Fetching...' : 'News'}</span>
                </Button>
                <Button
                  onClick={testRealNews}
                  disabled={isTestingNews || loading}
                  variant="outline"
                  className="border-green-500 text-green-600 hover:bg-green-50"
                  size="sm"
                >
                  🧪 Test
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBulkActionsVisible(!bulkActionsVisible)}
                  size="sm"
                >
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Bulk Actions</span>
                  <span className="sm:inline">Bulk</span>
                </Button>
                <Button onClick={fetchTweets} disabled={loading} size="sm">
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </div>

          {/* Status Overview */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
              Pending: {statusCounts.pending}
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
              Approved: {statusCounts.approved}
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
              Posted: {statusCounts.posted}
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
              Rejected: {statusCounts.rejected}
            </Badge>
          </div>

          {/* Bulk Actions Panel */}
          {bulkActionsVisible && (
            <div className="p-3 md:p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-4 gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={allPendingSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={pendingTweets.length === 0}
                    />
                    <Label className="text-sm font-medium">
                      Select All ({pendingTweets.length})
                    </Label>
                  </div>
                  {selectedTweets.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedTweets.length} selected
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkActionsVisible(false)}
                  className="self-end"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedTweets.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Button
                    onClick={handleBulkApprove}
                    className="bg-green-500 hover:bg-green-600"
                    size="sm"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="text-xs sm:text-sm">Approve {selectedTweets.length}</span>
                  </Button>
                  <Button
                    onClick={handleBulkReject}
                    variant="destructive"
                    size="sm"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="text-xs sm:text-sm">Reject {selectedTweets.length}</span>
                  </Button>
                  {approvedTweets.some(t => selectedTweets.includes(t.id)) && (
                    <Button
                      onClick={handleBulkPost}
                      className="bg-blue-500 hover:bg-blue-600"
                      size="sm"
                    >
                      <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="text-xs sm:text-sm">Post Now</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card rounded-lg border">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tweets or sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="techcrunch">TechCrunch</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tweet List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading tweets...</p>
              </div>
            ) : filteredTweets.length === 0 ? (
              <div className="text-center py-12">
                <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No tweets found.</p>
                <Button
                  onClick={fetchAiNews}
                  disabled={isFetchingNews || loading}
                  className="mb-2"
                >
                  <Newspaper className={`h-4 w-4 mr-2 ${isFetchingNews ? 'animate-pulse' : ''}`} />
                  <Download className={`h-3 w-3 mr-1 ${isFetchingNews ? 'animate-bounce' : ''}`} />
                  {isFetchingNews ? 'Fetching News...' : 'Fetch AI News Now'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Get the latest AI news and convert them to tweets automatically
                </p>
              </div>
            ) : (
              filteredTweets.map((tweet) => (
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={handleDelete}
                  isSelected={selectedTweets.includes(tweet.id)}
                  onSelect={handleSelectTweet}
                  showSelection={bulkActionsVisible}
                  approveDisabled={!autoPost}
                />
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
