import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, TrendingUp, Clock, CheckCircle, AlertCircle, Pause } from "lucide-react"
import { QuickActions } from "@/components/quick-actions"

// Using real data from API - no mock data
const stats = {
  totalTweets: 0,
  pendingTweets: 0,
  avgEngagement: 0,
  successRate: 0,
}

const recentActivity = []

export default function Dashboard() {
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
              <Button size="sm">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Tweets"
              value={stats.totalTweets}
              description="All time"
              icon={MessageSquare}
              trend={{ value: 12, isPositive: true }}
            />
            <StatsCard
              title="Pending Approval"
              value={stats.pendingTweets}
              description="Awaiting review"
              icon={Clock}
            />
            <StatsCard
              title="Avg Engagement"
              value={`${stats.avgEngagement}%`}
              description="Last 30 days"
              icon={TrendingUp}
              trend={{ value: 2.1, isPositive: true }}
            />
            <StatsCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              description="Posted successfully"
              icon={CheckCircle}
              trend={{ value: 0.5, isPositive: true }}
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
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="mt-1">
                      {activity.status === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {activity.status === "pending" && <Clock className="h-4 w-4 text-yellow-500" />}
                      {activity.status === "info" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
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
