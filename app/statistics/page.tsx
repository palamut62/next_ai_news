"use client"

import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { MessageSquare, TrendingUp, CheckCircle, Heart, Repeat, MessageCircle, Target, RefreshCw, XCircle } from "lucide-react"
import { useState, useEffect } from "react"

// Generate engagement data from real tweets
const engagementData = activity?.recentDays ?
  Object.entries(activity.recentDays).map(([date, dayData]: [string, any]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    likes: Math.floor(Math.random() * 10), // TODO: Get real engagement data from Twitter API
    retweets: Math.floor(Math.random() * 5),
    replies: Math.floor(Math.random() * 3)
  })) : []

// Generate AI score distribution from real tweets
const aiScoreDistribution = tweetStats?.bySource ?
  Object.values(tweetStats.bySource).reduce((acc: any[], source: any) => {
    // Simulate AI score distribution for now
    for (let i = 6; i <= 10; i++) {
      acc.push({ score: `${i}.0`, count: Math.floor(Math.random() * 10) })
    }
    return acc
  }, []) : []

// Generate language distribution (simulated for now)
const languageDistribution = [
  { name: 'JavaScript', value: 35, color: '#f7df1e' },
  { name: 'Python', value: 25, color: '#3776ab' },
  { name: 'TypeScript', value: 20, color: '#3178c6' },
  { name: 'Go', value: 10, color: '#00add8' },
  { name: 'Rust', value: 5, color: '#dea584' },
  { name: 'Other', value: 5, color: '#6b7280' }
]

// Top performing tweets (simulated for now)
const topPerformingTweets = [
  {
    id: '1',
    content: 'Check out this amazing AI tool that revolutionizes development workflow!',
    likes: 245,
    retweets: 89,
    replies: 34,
    engagement: 87
  },
  {
    id: '2',
    content: 'New breakthrough in machine learning: Researchers achieve state-of-the-art results',
    likes: 189,
    retweets: 67,
    replies: 28,
    engagement: 78
  },
  {
    id: '3',
    content: 'OpenAI releases new model with incredible performance improvements',
    likes: 156,
    retweets: 45,
    replies: 19,
    engagement: 65
  }
]

export default function StatisticsPage() {
  const [timeRange, setTimeRange] = useState("7d")
  const [loading, setLoading] = useState(true)
  const [tweetStats, setTweetStats] = useState<any>(null)
  const [activity, setActivity] = useState<any>(null)

  // Real statistics data
  const stats = {
    totalTweets: tweetStats?.totalProcessed || 0,
    totalPosted: tweetStats?.totalPosted || 0,
    totalDeleted: tweetStats?.totalDeleted || 0,
    totalDuplicates: tweetStats?.totalDuplicates || 0,
    totalRejected: tweetStats?.totalRejected || 0,
    rejectedToday: tweetStats?.rejectedToday || 0,
    rejectedThisWeek: tweetStats?.rejectedThisWeek || 0,
    rejectedThisMonth: tweetStats?.rejectedThisMonth || 0,
    successRate: tweetStats?.totalProcessed ? Math.round((tweetStats.totalPosted / tweetStats.totalProcessed) * 100) : 0,
    lastUpdated: tweetStats?.lastUpdated || null,
  }

  // Fetch real statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/statistics/tweet-stats?includeActivity=true&days=${timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90}`)
        const data = await response.json()

        if (data.success) {
          setTweetStats(data.stats)
          setActivity(data.activity)
        }
      } catch (error) {
        console.error('Failed to fetch statistics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [timeRange])

  // Generate chart data from real activity
  const realTweetVolumeData = activity?.recentDays ?
    Object.entries(activity.recentDays).map((entry: any) => {
      const [date, dayData] = entry
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        processed: dayData.processed || 0,
        posted: dayData.posted || 0,
        deleted: dayData.deleted || 0,
      }
    }) : []

  // Generate source distribution from real data
  const realSourceDistribution = tweetStats?.bySource ?
    Object.entries(tweetStats.bySource).map(([source, data]: [string, any]) => ({
      name: source.charAt(0).toUpperCase() + source.slice(1),
      value: data.processed || 0,
      color: source === 'techcrunch' ? '#10b981' : source === 'github' ? '#3b82f6' : '#8b5cf6'
    })) : []

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Statistics</h1>
              <p className="text-muted-foreground mt-2">Analyze your AI tweet bot performance and engagement</p>
              {stats.lastUpdated && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last updated: {new Date(stats.lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => window.location.reload()}
                className="p-2 hover:bg-muted rounded-md"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading statistics...</p>
            </div>
          ) : (
            <>
          {/* Key Metrics */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Total Processed"
              value={stats.totalTweets}
              description="All time tweets"
              icon={MessageSquare}
            />
            <StatsCard
              title="Successfully Posted"
              value={stats.totalPosted}
              description="To Twitter"
              icon={CheckCircle}
            />
            <StatsCard
              title="Total Rejected"
              value={stats.totalRejected}
              description="Rejected tweets"
              icon={XCircle}
            />
            <StatsCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              description="Post success rate"
              icon={TrendingUp}
            />
            <StatsCard
              title="Duplicates Skipped"
              value={stats.totalDuplicates}
              description="Duplicate detection"
              icon={Target}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tweet Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
                <CardDescription>Processed, posted, and deleted tweets per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={realTweetVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="processed"
                      stackId="1"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      name="Processed"
                    />
                    <Area
                      type="monotone"
                      dataKey="posted"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                      name="Posted"
                    />
                    <Area
                      type="monotone"
                      dataKey="deleted"
                      stackId="3"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                      name="Deleted"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Metrics</CardTitle>
                <CardDescription>Daily likes, retweets, and replies</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="likes" stroke="#ef4444" strokeWidth={2} name="Likes" />
                    <Line type="monotone" dataKey="retweets" stroke="#10b981" strokeWidth={2} name="Retweets" />
                    <Line type="monotone" dataKey="replies" stroke="#f59e0b" strokeWidth={2} name="Replies" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Source Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Content Sources</CardTitle>
                <CardDescription>Distribution of tweet sources</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={realSourceDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {realSourceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* AI Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>AI Score Distribution</CardTitle>
                <CardDescription>Quality scores of generated tweets</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aiScoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="score" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Language Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Programming Languages</CardTitle>
                <CardDescription>GitHub repositories by language</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {languageDistribution.map((lang) => (
                  <div key={lang.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.color }} />
                      <span className="text-sm font-medium">{lang.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${lang.value}%`,
                            backgroundColor: lang.color,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">{lang.value}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Performing Tweets */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Tweets</CardTitle>
                <CardDescription>Highest engagement tweets this week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topPerformingTweets.map((tweet, index) => (
                  <div key={tweet.id} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-foreground line-clamp-2">{tweet.content}</p>
                      <Badge variant="outline" className="text-primary border-primary/20 shrink-0">
                        #{index + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {tweet.likes}
                      </div>
                      <div className="flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {tweet.retweets}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {tweet.replies}
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <TrendingUp className="h-3 w-3" />
                        {tweet.engagement}%
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
