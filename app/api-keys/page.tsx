"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Eye, EyeOff, Check, X } from "lucide-react"

interface ApiKey {
  id: string
  service: string
  key_name: string
  api_key?: string
  is_active: boolean
  created_at: string
  updated_at: string
  description?: string
  usage_count: number
}

const API_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', icon: '🧠' },
  { id: 'anthropic', name: 'Anthropic Claude', icon: '✨' },
  { id: 'twitter', name: 'Twitter API', icon: '𝕏' },
  { id: 'github', name: 'GitHub API', icon: '🐙' },
  { id: 'techcrunch', name: 'TechCrunch', icon: '📰' },
]

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    service: 'gemini',
    key_name: '',
    api_key: '',
    description: '',
    // Twitter specific fields
    twitter_api_secret: '',
    twitter_access_token: '',
    twitter_access_token_secret: '',
    twitter_bearer_token: '',
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/api-keys')

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API returned non-JSON response:', await response.text())
        throw new Error('Server returned an invalid response')
      }

      const data = await response.json()
      setApiKeys(data.apiKeys || [])
    } catch (error: any) {
      console.error("Failed to fetch API keys:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch API keys",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.service === 'twitter') {
      // Twitter requires all 5 keys
      if (!formData.key_name || !formData.api_key || !formData.twitter_api_secret ||
          !formData.twitter_access_token || !formData.twitter_access_token_secret ||
          !formData.twitter_bearer_token) {
        toast({
          title: "Error",
          description: "Please fill in all Twitter API key fields",
          variant: "destructive",
        })
        return
      }
    } else {
      // Other services only need api_key
      if (!formData.key_name || !formData.api_key) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }
    }

    try {
      let requestBody: any = {
        service: formData.service,
        key_name: formData.key_name,
        api_key: formData.api_key,
        description: formData.description,
        is_active: true,
      }

      // For Twitter, store all keys in a JSON format
      if (formData.service === 'twitter') {
        requestBody.api_key = JSON.stringify({
          api_key: formData.api_key,
          api_secret: formData.twitter_api_secret,
          access_token: formData.twitter_access_token,
          access_token_secret: formData.twitter_access_token_secret,
          bearer_token: formData.twitter_bearer_token,
        })
      }

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API returned non-JSON response:', text)
        throw new Error('Server returned an invalid response')
      }

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: `API key for ${formData.service} saved successfully`,
        })
        setFormData({
          service: 'gemini',
          key_name: '',
          api_key: '',
          description: '',
          twitter_api_secret: '',
          twitter_access_token: '',
          twitter_access_token_secret: '',
          twitter_bearer_token: '',
        })
        setShowForm(false)
        fetchApiKeys()
      } else {
        throw new Error(data.error || "Failed to save API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save API key",
        variant: "destructive",
      })
    }
  }

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return

    try {
      const response = await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "API key deleted successfully",
        })
        fetchApiKeys()
      } else {
        throw new Error("Failed to delete API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete API key",
        variant: "destructive",
      })
    }
  }

  const handleToggleVisibility = (id: string) => {
    const newSet = new Set(visibleKeys)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setVisibleKeys(newSet)
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `API key ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        })
        fetchApiKeys()
      } else {
        throw new Error("Failed to update API key status")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update API key status",
        variant: "destructive",
      })
    }
  }

  const getProviderName = (service: string) => {
    return API_PROVIDERS.find(p => p.id === service)?.name || service
  }

  const getProviderIcon = (service: string) => {
    return API_PROVIDERS.find(p => p.id === service)?.icon || 'key'
  }

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
              <p className="text-muted-foreground mt-2">Manage API keys for various services</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "Add API Key"}
            </Button>
          </div>

          {/* Add API Key Form */}
          {showForm && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <form onSubmit={handleAddApiKey} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Service</label>
                      <select
                        value={formData.service}
                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground"
                      >
                        {API_PROVIDERS.map(provider => (
                          <option key={provider.id} value={provider.id}>
                            {provider.icon} {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground">Key Name</label>
                      <Input
                        type="text"
                        placeholder="e.g., Gemini Main, OpenAI Backup"
                        value={formData.key_name}
                        onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Twitter-specific fields */}
                  {formData.service === 'twitter' ? (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground">API Key</label>
                        <Input
                          type="password"
                          placeholder="TWITTER_API_KEY"
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          className="mt-1 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">API Secret</label>
                        <Input
                          type="password"
                          placeholder="TWITTER_API_SECRET"
                          value={formData.twitter_api_secret}
                          onChange={(e) => setFormData({ ...formData, twitter_api_secret: e.target.value })}
                          className="mt-1 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">Access Token</label>
                        <Input
                          type="password"
                          placeholder="TWITTER_ACCESS_TOKEN"
                          value={formData.twitter_access_token}
                          onChange={(e) => setFormData({ ...formData, twitter_access_token: e.target.value })}
                          className="mt-1 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">Access Token Secret</label>
                        <Input
                          type="password"
                          placeholder="TWITTER_ACCESS_TOKEN_SECRET"
                          value={formData.twitter_access_token_secret}
                          onChange={(e) => setFormData({ ...formData, twitter_access_token_secret: e.target.value })}
                          className="mt-1 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground">Bearer Token</label>
                        <Input
                          type="password"
                          placeholder="TWITTER_BEARER_TOKEN"
                          value={formData.twitter_bearer_token}
                          onChange={(e) => setFormData({ ...formData, twitter_bearer_token: e.target.value })}
                          className="mt-1 font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-sm font-medium text-foreground">API Key</label>
                      <Input
                        type="password"
                        placeholder="Paste your API key here"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        className="mt-1 font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                    <Input
                      type="text"
                      placeholder="e.g., Production key, tested on 2025-11-08"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Save API Key</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* API Keys List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No API keys configured yet</p>
                  <Button onClick={() => setShowForm(true)} variant="outline">
                    Add your first API key
                  </Button>
                </CardContent>
              </Card>
            ) : (
              apiKeys.map((apiKey) => (
                <Card key={apiKey.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{getProviderIcon(apiKey.service)}</span>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {apiKey.key_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {getProviderName(apiKey.service)}
                              </p>
                            </div>
                          </div>
                          {apiKey.description && (
                            <p className="text-xs text-muted-foreground ml-8 mt-1">
                              {apiKey.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* API Key Display */}
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <input
                            type={visibleKeys.has(apiKey.id) ? "text" : "password"}
                            value={apiKey.api_key}
                            readOnly
                            className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm font-mono"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleVisibility(apiKey.id)}
                            title={visibleKeys.has(apiKey.id) ? "Hide" : "Show"}
                            className="h-8 w-8 p-0"
                          >
                            {visibleKeys.has(apiKey.id) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Created: {new Date(apiKey.created_at).toLocaleDateString()}</p>
                          <p>Usage: {apiKey.usage_count} times</p>
                        </div>

                        <div className="flex gap-1 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(apiKey.id, apiKey.is_active)}
                            title={apiKey.is_active ? "Disable" : "Enable"}
                            className="h-8 w-8 p-0"
                          >
                            {apiKey.is_active ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteApiKey(apiKey.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}
