"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { Tweet } from "@/lib/types"
import { Check, X, ExternalLink, Star, GitFork, Calendar, TrendingUp, Share2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TweetCardProps {
  tweet: Tweet
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onDelete?: (id: string) => void
  isSelected?: boolean
  onSelect?: (id: string, checked: boolean) => void
  showSelection?: boolean
  approveDisabled?: boolean
}

export function TweetCard({ tweet, onApprove, onReject, onDelete, isSelected, onSelect, showSelection, approveDisabled }: TweetCardProps) {

  // Function to open Twitter with pre-filled tweet content and source URL
  const shareOnTwitter = () => {
    const tweetText = tweet.content
    const sourceUrl = tweet.sourceUrl

    // Combine tweet content with source URL if it fits within character limit
    let fullTweet = tweetText
    if (sourceUrl && tweetText.length + sourceUrl.length + 1 <= 280) {
      fullTweet = `${tweetText} ${sourceUrl}`
    }

    const encodedTweet = encodeURIComponent(fullTweet)
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTweet}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
  }

  const getSourceIcon = () => {
    switch (tweet.source) {
      case "github":
        return <GitFork className="h-4 w-4" />
      case "techcrunch":
        return <TrendingUp className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    switch (tweet.status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "approved":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "posted":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <Card className={`hover:bg-muted/50 transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {showSelection && tweet.status === 'pending' && onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(tweet.id, checked as boolean)}
              />
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getSourceIcon()}
            <span className="capitalize">{tweet.source}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(tweet.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor()}>
              {tweet.status}
            </Badge>
            <Badge variant="outline" className="text-primary border-primary/20">
              <Star className="h-3 w-3 mr-1" />
              {tweet.aiScore.toFixed(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tweet Content */}
        <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
          <p className="text-sm leading-relaxed text-foreground">{tweet.content}</p>
        </div>

        {/* Source Information */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Source:</span>
          <a
            href={tweet.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            {tweet.sourceTitle}
            <ExternalLink className="h-3 w-3" />
          </a>
          {tweet.newsDate && (
            <>
              <span>•</span>
              <span>News Date: {new Date(tweet.newsDate).toLocaleDateString()}</span>
            </>
          )}
        </div>

        {/* Engagement Stats (if posted) */}
        {tweet.status === "posted" && tweet.engagement && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Likes: {tweet.engagement.likes}</span>
            <span>Retweets: {tweet.engagement.retweets}</span>
            <span>Replies: {tweet.engagement.replies}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {/* Manual Twitter Share Button - Always visible */}
          <Button
            size="sm"
            variant="outline"
            onClick={shareOnTwitter}
            className="border-blue-500/20 text-blue-500 hover:bg-blue-500/10"
            title="Share manually on Twitter"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share on Twitter
          </Button>

          {tweet.status === "pending" && (
            <>
              <Button size="sm" onClick={() => onApprove?.(tweet.id)} className="bg-green-600 hover:bg-green-700" disabled={approveDisabled}>
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject?.(tweet.id)}
                className="border-red-500/20 text-red-500 hover:bg-red-500/10"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}

          {tweet.status === "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete?.(tweet.id)}
              className="border-red-500/20 text-red-500 hover:bg-red-500/10"
            >
              <X className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        {tweet.scheduledAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Scheduled for {new Date(tweet.scheduledAt).toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
