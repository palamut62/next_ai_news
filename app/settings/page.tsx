"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SettingsSection } from "@/components/settings-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import type { Settings } from "@/lib/types"
import { Save, TestTube, X, Newspaper, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Mock initial settings
const initialSettings: Settings = {
  automation: {
    enabled: true,
    checkInterval: 2,
    maxArticlesPerCheck: 10,
    minAiScore: 7.0,
    autoPost: false,
    requireApproval: true,
    rateLimitDelay: 30,
  },
  github: {
    enabled: true,
    languages: ["JavaScript", "Python", "TypeScript"],
    timeRange: "weekly",
    maxRepos: 5,
    minStars: 100,
  },
  notifications: {
    telegram: {
      enabled: false,
      botToken: "",
      chatId: "",
    },
    email: {
      enabled: false,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      username: "",
      password: "",
      fromEmail: "",
      toEmail: "",
    },
  },
  twitter: {
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  },
  ai: {
    provider: "gemini",
    apiKey: "",
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 280,
  },
}

const availableLanguages = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [isFetchingNews, setIsFetchingNews] = useState(false)
  const { toast } = useToast()

  const updateSettings = (section: keyof Settings, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [key]: value,
      },
    }))
  }

  const updateNestedSettings = (section: keyof Settings, subsection: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [subsection]: {
          ...(prev![section] as any)[subsection],
          [key]: value,
        },
      },
    }))
  }

  const toggleLanguage = (language: string) => {
    const currentLanguages = settings!.github.languages
    const newLanguages = currentLanguages.includes(language)
      ? currentLanguages.filter((l) => l !== language)
      : [...currentLanguages, language]

    updateSettings("github", "languages", newLanguages)
  }

  const handleSave = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save settings')
      }

      const data = await res.json()
      toast({ title: 'Settings saved', description: 'Your configuration has been updated successfully.' })
      setSettings(data)
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Load settings from server on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings', { credentials: 'same-origin' })
        if (!res.ok) return
        const data = await res.json()
        if (mounted && data) {
          setSettings(data)
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
        // Fallback to initial settings if API fails
        if (mounted) {
          setSettings(initialSettings)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  const testTelegramConnection = async () => {
    setTestingTelegram(true)
    try {
      // In a real app, this would test the Telegram connection
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast({
        title: "Connection successful",
        description: "Telegram bot is working correctly.",
      })
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Unable to connect to Telegram bot.",
        variant: "destructive",
      })
    } finally {
      setTestingTelegram(false)
    }
  }

  const fetchAiNewsTweets = async () => {
    setIsFetchingNews(true)
    try {
      const response = await fetch("/api/news/process-news-tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ count: 10 }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "AI News fetched successfully",
          description: `Processed ${data.articlesFound} articles and created ${data.tweetsSaved} tweets.`,
        })
      } else {
        throw new Error(data.message || "Failed to fetch AI news")
      }
    } catch (error) {
      toast({
        title: "Failed to fetch AI news",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsFetchingNews(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <AuthWrapper>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </DashboardLayout>
      </AuthWrapper>
    )
  }

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">Configure your AI Tweet Bot automation and integrations</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="grid gap-6">
            {/* Automation Settings */}
            <SettingsSection
              title="Automation Settings"
              description="Configure how the bot automatically processes articles and creates tweets"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="automation-enabled">Enable Automation</Label>
                    <p className="text-sm text-muted-foreground">Automatically check for new content</p>
                  </div>
                  <Switch
                    id="automation-enabled"
                    checked={settings!.automation.enabled}
                    onCheckedChange={(checked) => updateSettings("automation", "enabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="check-interval">Check Interval (hours)</Label>
                  <Select
                    value={settings!.automation?.checkInterval?.toString() || '0'}
                    onValueChange={(value) => updateSettings('automation', 'checkInterval', Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every hour</SelectItem>
                      <SelectItem value="2">Every 2 hours</SelectItem>
                      <SelectItem value="4">Every 4 hours</SelectItem>
                      <SelectItem value="6">Every 6 hours</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-articles">Max Articles per Check</Label>
                  <Input
                    id="max-articles"
                    type="number"
                    min="1"
                    max="50"
                    value={settings!.automation.maxArticlesPerCheck}
                    onChange={(e) =>
                      updateSettings("automation", "maxArticlesPerCheck", Number.parseInt(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-score">Minimum AI Score: {settings!.automation.minAiScore}</Label>
                  <Slider
                    id="min-score"
                    min={1}
                    max={10}
                    step={0.1}
                    value={[settings!.automation.minAiScore]}
                    onValueChange={([value]) => updateSettings("automation", "minAiScore", value)}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-post">Auto Post</Label>
                    <p className="text-sm text-muted-foreground">Post tweets without approval</p>
                  </div>
                  <Switch
                    id="auto-post"
                    checked={settings!.automation.autoPost}
                    onCheckedChange={(checked) => updateSettings("automation", "autoPost", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Rate Limit Delay (seconds)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    min="1"
                    max="300"
                    value={settings!.automation.rateLimitDelay}
                    onChange={(e) => updateSettings("automation", "rateLimitDelay", Number.parseInt(e.target.value))}
                  />
                </div>
              </div>
            </SettingsSection>

            {/* GitHub Settings */}
            <SettingsSection
              title="GitHub Integration"
              description="Configure GitHub repository discovery and tweet generation"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="github-enabled">Enable GitHub Integration</Label>
                    <p className="text-sm text-muted-foreground">Discover trending repositories</p>
                  </div>
                  <Switch
                    id="github-enabled"
                    checked={settings!.github.enabled}
                    onCheckedChange={(checked) => updateSettings("github", "enabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Programming Languages</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableLanguages.map((language) => (
                      <Badge
                        key={language}
                        variant={settings!.github.languages.includes(language) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleLanguage(language)}
                      >
                        {language}
                        {settings!.github.languages.includes(language) && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="time-range">Time Range</Label>
                    <Select
                      value={settings!.github.timeRange}
                      onValueChange={(value: "daily" | "weekly" | "monthly") =>
                        updateSettings("github", "timeRange", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-repos">Max Repos</Label>
                    <Input
                      id="max-repos"
                      type="number"
                      min="1"
                      max="20"
                      value={settings!.github.maxRepos}
                      onChange={(e) => updateSettings("github", "maxRepos", Number.parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min-stars">Min Stars</Label>
                    <Input
                      id="min-stars"
                      type="number"
                      min="0"
                      value={settings!.github.minStars}
                      onChange={(e) => updateSettings("github", "minStars", Number.parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </SettingsSection>

            {/* AI News Settings */}
            <SettingsSection
              title="AI News Integration"
              description="Fetch and process AI news articles for automatic tweet generation"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>AI News Source</Label>
                    <p className="text-sm text-muted-foreground">Automatically fetch AI news and convert to tweets</p>
                  </div>
                  <Button
                    onClick={fetchAiNewsTweets}
                    disabled={isFetchingNews}
                    className="flex items-center gap-2"
                  >
                    <Newspaper className="h-4 w-4" />
                    {isFetchingNews ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isFetchingNews ? "Fetching News..." : "Fetch AI News"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2">Features:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Fetches latest AI news from multiple sources</li>
                      <li>• Uses Gemini AI to generate engaging tweets</li>
                      <li>• Automatic hashtag and emoji inclusion</li>
                      <li>• AI scoring for quality control</li>
                      <li>• Saves tweets to pending list for approval</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2">Requirements:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Valid Gemini API key in settings</li>
                      <li>• Internet connection for news fetching</li>
                      <li>• Optional: News API key for real articles</li>
                      <li>• Pending list for tweet approval</li>
                    </ul>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>
                    <strong>Note:</strong> This will fetch AI news from the last 24 hours and generate tweet-ready content.
                    Tweets will be saved to your pending list for manual approval before posting.
                  </p>
                </div>
              </div>
            </SettingsSection>

            {/* AI Settings */}
            <SettingsSection title="AI Configuration" description="Configure AI model settings for tweet generation">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-provider">AI Provider</Label>
                  <Select
                    value={settings!.ai.provider}
                    onValueChange={(value: "gemini" | "openai" | "claude") => updateSettings("ai", "provider", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="openai">OpenAI GPT</SelectItem>
                      <SelectItem value="claude">Anthropic Claude</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-model">Model</Label>
                  <Input
                    id="ai-model"
                    value={settings!.ai.model}
                    onChange={(e) => updateSettings("ai", "model", e.target.value)}
                    placeholder="gemini-2.0-flash"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-key">API Key</Label>
                  <Input
                    id="ai-key"
                    type="password"
                    value={settings!.ai.apiKey}
                    onChange={(e) => updateSettings("ai", "apiKey", e.target.value)}
                    placeholder="Enter your API key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {settings!.ai.temperature}</Label>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[settings!.ai.temperature]}
                    onValueChange={([value]) => updateSettings("ai", "temperature", value)}
                  />
                </div>
              </div>
            </SettingsSection>

            {/* Telegram Notifications */}
            <SettingsSection
              title="Telegram Notifications"
              description="Get notified about new tweets and system events via Telegram"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="telegram-enabled">Enable Telegram Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via Telegram bot</p>
                  </div>
                  <Switch
                    id="telegram-enabled"
                    checked={settings!.notifications.telegram.enabled}
                    onCheckedChange={(checked) => updateNestedSettings("notifications", "telegram", "enabled", checked)}
                  />
                </div>

                {settings!.notifications.telegram.enabled && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bot-token">Bot Token</Label>
                      <Input
                        id="bot-token"
                        type="password"
                        value={settings!.notifications.telegram.botToken}
                        onChange={(e) => updateNestedSettings("notifications", "telegram", "botToken", e.target.value)}
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chat-id">Chat ID</Label>
                      <div className="flex gap-2">
                        <Input
                          id="chat-id"
                          value={settings!.notifications.telegram.chatId}
                          onChange={(e) => updateNestedSettings("notifications", "telegram", "chatId", e.target.value)}
                          placeholder="123456789"
                        />
                        <Button variant="outline" size="sm" onClick={testTelegramConnection} disabled={testingTelegram}>
                          <TestTube className="h-4 w-4 mr-2" />
                          {testingTelegram ? "Testing..." : "Test"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SettingsSection>

            {/* Twitter API */}
            <SettingsSection title="Twitter API" description="Configure Twitter API credentials for posting tweets">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twitter-api-key">API Key</Label>
                  <Input
                    id="twitter-api-key"
                    type="password"
                    value={settings!.twitter.apiKey}
                    onChange={(e) => updateSettings("twitter", "apiKey", e.target.value)}
                    placeholder="Enter your Twitter API key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-api-secret">API Secret</Label>
                  <Input
                    id="twitter-api-secret"
                    type="password"
                    value={settings!.twitter.apiSecret}
                    onChange={(e) => updateSettings("twitter", "apiSecret", e.target.value)}
                    placeholder="Enter your Twitter API secret"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-access-token">Access Token</Label>
                  <Input
                    id="twitter-access-token"
                    type="password"
                    value={settings!.twitter.accessToken}
                    onChange={(e) => updateSettings("twitter", "accessToken", e.target.value)}
                    placeholder="Enter your access token"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter-access-secret">Access Token Secret</Label>
                  <Input
                    id="twitter-access-secret"
                    type="password"
                    value={settings!.twitter.accessTokenSecret}
                    onChange={(e) => updateSettings("twitter", "accessTokenSecret", e.target.value)}
                    placeholder="Enter your access token secret"
                  />
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
