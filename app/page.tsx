"use client"

import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, TrendingUp, Clock, CheckCircle, AlertCircle, Pause, RefreshCw } from "lucide-react"
import { QuickActions } from "@/components/quick-actions"
import { useState, useEffect } from "react"

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTweets: 0,
    pendingTweets: 0,
    approvedTweets: 0,
    postedTweets: 0,
    avgEngagement: 0,
    successRate: 0,
  })

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // Get current tweets - include all statuses (including posted)
      const tweetsResponse = await fetch('/api/tweets?status=all')
      const tweets = await tweetsResponse.json()

      // Get statistics
      const statsResponse = await fetch('/api/statistics/tweet-stats')
      const statsData = await statsResponse.json()

      // Calculate current stats
      const pendingTweets = tweets.filter((t: any) => t.status === 'pending').length
      const approvedTweets = tweets.filter((t: any) => t.status === 'approved').length
      const postedTweets = tweets.filter((t: any) => t.status === 'posted').length
      const totalTweets = tweets.length

      const successRate = statsData.stats?.totalProcessed
        ? Math.round((statsData.stats.totalPosted / statsData.stats.totalProcessed) * 100)
        : 0

      setStats({
        totalTweets,
        pendingTweets,
        approvedTweets,
        postedTweets,
        avgEngagement: 0, // TODO: Calculate from engagement data
        successRate,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardStats()
  }, [])
  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-2">Monitor your AI tweet automation and performance</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-500 border-green-500/20">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                Automation Active
              </Badge>
              <Button size="sm" onClick={fetchDashboardStats} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Tweets"
              value={stats.totalTweets}
              description="All tweets"
              icon={MessageSquare}
            />
            <StatsCard
              title="Pending Approval"
              value={stats.pendingTweets}
              description="Awaiting review"
              icon={Clock}
            />
            <StatsCard
              title="Approved"
              value={stats.approvedTweets}
              description="Ready to post"
              icon={CheckCircle}
            />
            <StatsCard
              title="Posted"
              value={stats.postedTweets}
              description="On Twitter"
              icon={TrendingUp}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest automation events and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading activity...</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <p className="text-sm text-muted-foreground">
                      {stats.pendingTweets} pending • {stats.approvedTweets} approved • {stats.postedTweets} posted
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Success rate: {stats.successRate}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and controls</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Client-side actions incl. manual news scan */}
                <QuickActions />
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
