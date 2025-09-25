"use client"

import { Card, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GitHubRepo } from "@/lib/types"
import { Star, GitFork, ExternalLink, MessageSquare, Calendar, TrendingUp, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface RepoCardProps {
  repo: GitHubRepo & { trendingScore?: number }
  onGenerateTweet?: (repo: GitHubRepo) => void
  onRejectRepo?: (repo: GitHubRepo) => void
  isGenerating?: boolean
  isRejecting?: boolean
}

export function RepoCard({ repo, onGenerateTweet, onRejectRepo, isGenerating, isRejecting }: RepoCardProps) {
  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      JavaScript: "#f1e05a",
      TypeScript: "#2b7489",
      Python: "#3572A5",
      Rust: "#dea584",
      Go: "#00ADD8",
      Java: "#b07219",
      "C++": "#f34b7d",
      "C#": "#239120",
      PHP: "#4F5D95",
      Ruby: "#701516",
      Swift: "#ffac45",
      Kotlin: "#F18E33",
    }
    return colors[language] || "#6b7280"
  }

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">{repo.name}</h3>
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{repo.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getLanguageColor(repo.language) }} />
                <span>{repo.language}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                <span>{repo.stars.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitFork className="h-4 w-4" />
                <span>{repo.forks.toLocaleString()}</span>
              </div>
              {repo.trendingScore && (
                <div className="flex items-center gap-1 text-orange-500">
                  <TrendingUp className="h-4 w-4" />
                  <span>{repo.trendingScore.toFixed(0)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="text-orange-500 border-orange-500/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending
            </Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onGenerateTweet?.(repo)}
                disabled={isGenerating}
                className="bg-primary hover:bg-primary/90"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate Tweet"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRejectRepo?.(repo)}
                disabled={isRejecting}
              >
                <X className="h-4 w-4 mr-2" />
                {isRejecting ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
