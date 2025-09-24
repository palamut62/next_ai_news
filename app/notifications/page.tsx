"use client"

import { useState } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NotificationItem } from "@/components/notification-item"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Notification } from "@/lib/types"
import { Bell, CheckCircle, Trash2, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "tweet_created",
    title: "New Tweet Generated",
    message:
      "AI generated a tweet about 'Revolutionary AI Architecture Reduces Compute by 60%' from TechCrunch. The tweet scored 8.7/10 and is pending your approval.",
    timestamp: "2024-01-15T10:30:00Z",
    read: false,
    severity: "info",
    metadata: {
      tweetId: "tweet-123",
    },
  },
  {
    id: "2",
    type: "tweet_posted",
    title: "Tweet Posted Successfully",
    message:
      "Your tweet about the new database management tool has been posted to Twitter and is already gaining engagement with 45 likes and 12 retweets.",
    timestamp: "2024-01-15T09:15:00Z",
    read: false,
    severity: "success",
    metadata: {
      tweetId: "tweet-122",
    },
  },
  {
    id: "3",
    type: "github_repo_found",
    title: "Trending Repository Discovered",
    message:
      "Found a trending repository 'neural-search' with 15.4k stars. It's a semantic search engine built with Rust. Would you like to generate a tweet?",
    timestamp: "2024-01-15T08:45:00Z",
    read: true,
    severity: "info",
    metadata: {
      repoId: "repo-456",
    },
  },
  {
    id: "4",
    type: "system_error",
    title: "API Rate Limit Reached",
    message:
      "Twitter API rate limit has been reached. Automatic posting is temporarily paused. It will resume in 15 minutes.",
    timestamp: "2024-01-15T07:20:00Z",
    read: false,
    severity: "warning",
    metadata: {
      errorCode: "RATE_LIMIT_EXCEEDED",
    },
  },
  {
    id: "5",
    type: "tweet_approved",
    title: "Tweet Approved",
    message:
      "You approved the tweet about 'New Web Framework Promises 3x Performance Boost'. It has been scheduled for posting at 2:00 PM.",
    timestamp: "2024-01-14T16:30:00Z",
    read: true,
    severity: "success",
    metadata: {
      tweetId: "tweet-121",
    },
  },
  {
    id: "6",
    type: "automation_paused",
    title: "Automation Paused",
    message:
      "Automatic tweet generation has been paused due to multiple failed attempts to connect to the AI service. Please check your API configuration.",
    timestamp: "2024-01-14T14:15:00Z",
    read: true,
    severity: "error",
    metadata: {
      errorCode: "AI_SERVICE_UNAVAILABLE",
    },
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const { toast } = useToast()
  const router = useRouter()

  const filteredNotifications = notifications
    .filter((notification) => {
      if (filter === "unread") return !notification.read
      if (filter === "read") return notification.read
      if (filter !== "all") return notification.severity === filter
      return true
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      if (sortBy === "oldest") {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      }
      if (sortBy === "unread") {
        return Number(b.read) - Number(a.read)
      }
      return 0
    })

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
    toast({
      title: "Notification marked as read",
      description: "The notification has been marked as read.",
    })
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    toast({
      title: "Notification deleted",
      description: "The notification has been removed.",
    })
  }

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
    toast({
      title: "All notifications marked as read",
      description: "All notifications have been marked as read.",
    })
  }

  const handleClearAll = () => {
    setNotifications([])
    toast({
      title: "All notifications cleared",
      description: "All notifications have been removed.",
    })
  }

  const handleAction = (notification: Notification) => {
    if (notification.metadata?.tweetId) {
      router.push("/tweets")
    } else if (notification.metadata?.repoId) {
      router.push("/github")
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length
  const severityCounts = {
    info: notifications.filter((n) => n.severity === "info").length,
    success: notifications.filter((n) => n.severity === "success").length,
    warning: notifications.filter((n) => n.severity === "warning").length,
    error: notifications.filter((n) => n.severity === "error").length,
  }

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
              <p className="text-muted-foreground mt-2">Stay updated with your AI tweet bot activity</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
              <Button variant="outline" onClick={handleClearAll} disabled={notifications.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <span className="font-medium">Total: {notifications.length}</span>
            </div>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
              Unread: {unreadCount}
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
              Info: {severityCounts.info}
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Success: {severityCounts.success}
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Warning: {severityCounts.warning}
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
              Error: {severityCounts.error}
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="unread">Unread First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No notifications found matching your criteria.</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  onAction={handleAction}
                />
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
