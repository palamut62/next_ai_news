"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Notification } from "@/lib/types"
import {
  CheckCircle,
  AlertCircle,
  Info,
  XCircle,
  MessageSquare,
  Github,
  Play,
  Pause,
  X,
  ExternalLink,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead?: (id: string) => void
  onDelete?: (id: string) => void
  onAction?: (notification: Notification) => void
}

export function NotificationItem({ notification, onMarkAsRead, onDelete, onAction }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "tweet_created":
      case "tweet_posted":
      case "tweet_approved":
        return <MessageSquare className="h-4 w-4" />
      case "tweet_rejected":
        return <XCircle className="h-4 w-4" />
      case "github_repo_found":
        return <Github className="h-4 w-4" />
      case "automation_paused":
        return <Pause className="h-4 w-4" />
      case "automation_resumed":
        return <Play className="h-4 w-4" />
      case "system_error":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getSeverityColor = () => {
    switch (notification.severity) {
      case "success":
        return "text-green-500"
      case "warning":
        return "text-yellow-500"
      case "error":
        return "text-red-500"
      default:
        return "text-blue-500"
    }
  }

  const getSeverityBadge = () => {
    switch (notification.severity) {
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    }
  }

  const hasAction = notification.metadata?.tweetId || notification.metadata?.repoId

  return (
    <Card className={`transition-colors ${notification.read ? "opacity-60" : "bg-muted/30"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${getSeverityColor()}`}>{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-medium text-foreground text-sm">{notification.title}</h4>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={getSeverityColor()}>
                  {notification.severity}
                </Badge>
                {!notification.read && <div className="w-2 h-2 bg-primary rounded-full" />}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{notification.message}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
              </span>
              <div className="flex items-center gap-2">
                {hasAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction?.(notification)}
                    className="h-7 px-2 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
                {!notification.read && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkAsRead?.(notification.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mark Read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete?.(notification.id)}
                  className="h-7 px-2 text-xs border-red-500/20 text-red-500 hover:bg-red-500/10"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
