"use client"

import { useState, useEffect } from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Eye, EyeOff, Check, X, Copy } from "lucide-react"

interface TwitterApiKey {
  id: string
  key_name: string
  api_key?: string
  api_secret?: string
  access_token?: string
  access_token_secret?: string
  bearer_token?: string
  is_active: boolean
  created_at: string
  updated_at: string
  description?: string
  usage_count: number
  last_used?: string
}

const TWITTER_KEY_FIELDS = [
  { name: 'api_key', label: 'API Key', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXX' },
  { name: 'api_secret', label: 'API Secret', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
  { name: 'access_token', label: 'Access Token', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
  { name: 'access_token_secret', label: 'Access Token Secret', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
  { name: 'bearer_token', label: 'Bearer Token', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
]

export default function TwitterApiKeysPage() {
  const [twitterKeys, setTwitterKeys] = useState<TwitterApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    key_name: '',
    api_key: '',
    api_secret: '',
    access_token: '',
    access_token_secret: '',
    bearer_token: '',
    description: '',
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchTwitterKeys()
  }, [])

  const fetchTwitterKeys = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/twitter-keys')

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API returned non-JSON response:', await response.text())
        throw new Error('Server returned an invalid response')
      }

      const data = await response.json()
      setTwitterKeys(data.twitterKeys || [])
    } catch (error: any) {
      console.error("Failed to fetch Twitter API keys:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch Twitter API keys",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTwitterKey = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    if (!formData.key_name || !formData.api_key || !formData.api_secret ||
        !formData.access_token || !formData.access_token_secret || !formData.bearer_token) {
      toast({
        title: "Error",
        description: "Please fill in all Twitter API key fields",
        variant: "destructive",
      })
      return
    }

    try {
      const requestBody = {
        key_name: formData.key_name,
        api_key: formData.api_key,
        api_secret: formData.api_secret,
        access_token: formData.access_token,
        access_token_secret: formData.access_token_secret,
        bearer_token: formData.bearer_token,
        description: formData.description || undefined,
        is_active: true,
      }

      const response = await fetch('/api/twitter-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

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
          description: `Twitter API key '${formData.key_name}' saved successfully`,
        })
        setFormData({
          key_name: '',
          api_key: '',
          api_secret: '',
          access_token: '',
          access_token_secret: '',
          bearer_token: '',
          description: '',
        })
        setShowForm(false)
        setEditingId(null)
        fetchTwitterKeys()
      } else {
        throw new Error(data.error || "Failed to save Twitter API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save Twitter API key",
        variant: "destructive",
      })
    }
  }

  const handleEditKey = async (id: string) => {
    try {
      const response = await fetch(`/api/twitter-keys?id=${id}`)
      const data = await response.json()

      setFormData({
        key_name: data.key_name,
        api_key: data.api_key,
        api_secret: data.api_secret,
        access_token: data.access_token,
        access_token_secret: data.access_token_secret,
        bearer_token: data.bearer_token,
        description: data.description || '',
      })
      setEditingId(id)
      setShowForm(true)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load Twitter API key for editing",
        variant: "destructive",
      })
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Twitter API key?")) return

    try {
      const response = await fetch(`/api/twitter-keys?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Twitter API key deleted successfully",
        })
        fetchTwitterKeys()
      } else {
        throw new Error("Failed to delete Twitter API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete Twitter API key",
        variant: "destructive",
      })
    }
  }

  const handleToggleVisibility = (fieldKey: string) => {
    const newSet = new Set(visibleKeys)
    if (newSet.has(fieldKey)) {
      newSet.delete(fieldKey)
    } else {
      newSet.add(fieldKey)
    }
    setVisibleKeys(newSet)
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/twitter-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Twitter API key ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        })
        fetchTwitterKeys()
      } else {
        throw new Error("Failed to update Twitter API key status")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update Twitter API key status",
        variant: "destructive",
      })
    }
  }

  const handleCopyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value)
    toast({
      title: "Copied",
      description: "Value copied to clipboard",
    })
  }

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Twitter API Keys</h1>
              <p className="text-muted-foreground mt-2">Manage separate Twitter API credentials</p>
            </div>
            <Button onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData({
                key_name: '',
                api_key: '',
                api_secret: '',
                access_token: '',
                access_token_secret: '',
                bearer_token: '',
                description: '',
              })
            }} className="gap-2">
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "Add Twitter Key"}
            </Button>
          </div>

          {/* Add/Edit Twitter Key Form */}
          {showForm && (
            <Card className="bg-muted/50">
              <CardHeader>
                <h2 className="font-semibold text-foreground">
                  {editingId ? 'Edit' : 'Add'} Twitter API Key
                </h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTwitterKey} className="space-y-4">
                  {/* Key Name */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Key Name</label>
                    <Input
                      type="text"
                      placeholder="e.g., Main Account, Backup Account"
                      value={formData.key_name}
                      onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {/* Twitter Key Fields */}
                  <div className="grid grid-cols-1 gap-4">
                    {TWITTER_KEY_FIELDS.map((field) => (
                      <div key={field.name}>
                        <label className="text-sm font-medium text-foreground">{field.label}</label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type={visibleKeys.has(field.name) ? "text" : "password"}
                            placeholder={field.placeholder}
                            value={formData[field.name as keyof typeof formData]}
                            onChange={(e) => setFormData({
                              ...formData,
                              [field.name]: e.target.value
                            })}
                            className="flex-1 font-mono text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleVisibility(field.name)}
                            className="px-2"
                          >
                            {visibleKeys.has(field.name) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                    <Input
                      type="text"
                      placeholder="e.g., Production account, tested on 2025-11-12"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingId ? 'Update' : 'Save'} Twitter Key
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false)
                        setEditingId(null)
                        setFormData({
                          key_name: '',
                          api_key: '',
                          api_secret: '',
                          access_token: '',
                          access_token_secret: '',
                          bearer_token: '',
                          description: '',
                        })
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Twitter Keys List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading Twitter API keys...</p>
              </div>
            ) : twitterKeys.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No Twitter API keys configured yet</p>
                  <Button onClick={() => setShowForm(true)} variant="outline">
                    Add your first Twitter API key
                  </Button>
                </CardContent>
              </Card>
            ) : (
              twitterKeys.map((twitterKey) => (
                <Card key={twitterKey.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">𝕏</span>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {twitterKey.key_name}
                              </h3>
                              {twitterKey.description && (
                                <p className="text-xs text-muted-foreground">
                                  {twitterKey.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Indicator */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(twitterKey.id, twitterKey.is_active)}
                          title={twitterKey.is_active ? "Disable" : "Enable"}
                          className="h-8 w-8 p-0"
                        >
                          {twitterKey.is_active ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </div>

                      {/* Stats */}
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Created: {new Date(twitterKey.created_at).toLocaleDateString()}</span>
                          <span>Usage: {twitterKey.usage_count} times</span>
                        </div>
                        {twitterKey.last_used && (
                          <div className="text-xs text-muted-foreground">
                            Last used: {new Date(twitterKey.last_used).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Keys Display */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {TWITTER_KEY_FIELDS.map((field) => (
                          <div key={field.name} className="bg-muted p-2 rounded">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="text-xs font-medium text-foreground">
                                {field.label}
                              </label>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleVisibility(`detail-${twitterKey.id}-${field.name}`)}
                                  className="h-6 w-6 p-0"
                                >
                                  {visibleKeys.has(`detail-${twitterKey.id}-${field.name}`) ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            {twitterKey[field.name as keyof TwitterApiKey] && (
                              <div className="flex gap-1">
                                <input
                                  type={visibleKeys.has(`detail-${twitterKey.id}-${field.name}`) ? "text" : "password"}
                                  value={twitterKey[field.name as keyof TwitterApiKey] as string || ''}
                                  readOnly
                                  className="flex-1 bg-background border border-input rounded px-2 py-1 text-xs font-mono"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyToClipboard(twitterKey[field.name as keyof TwitterApiKey] as string)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditKey(twitterKey.id)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteKey(twitterKey.id)}
                          className="gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
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
