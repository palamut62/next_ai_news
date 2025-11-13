"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { AuthWrapper } from "@/components/auth-wrapper"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Link,
  Image,
  Type,
  Wand2,
  Send,
  Save,
  RefreshCw,
  ExternalLink,
  Upload,
  X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function CreateTweetPage() {
  const [activeTab, setActiveTab] = useState("link")
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [autoPost, setAutoPost] = useState(true)

  // Form states
  const [linkUrl, setLinkUrl] = useState("")
  const [customText, setCustomText] = useState("")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")

  // Generated tweet
  const [generatedTweet, setGeneratedTweet] = useState("")
  const [aiScore, setAiScore] = useState<number | null>(null)
  const [tweetLength, setTweetLength] = useState<number | null>(null)

  const { toast } = useToast()

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setUploadedImage(null)
    setImagePreview("")
  }

  const generateTweetFromLink = async () => {
    if (!linkUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/tweets/generate-from-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl })
      })

      const data = await response.json()

      if (response.ok) {
        setGeneratedTweet(data.tweet)
        setAiScore(data.aiScore)
        setTweetLength(data.tweetLength || data.tweet.length)
        toast({
          title: "Success",
          description: "Tweet generated successfully!"
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tweet from link",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateTweetFromText = async () => {
    if (!customText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/tweets/generate-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customText })
      })

      const data = await response.json()

      if (response.ok) {
        setGeneratedTweet(data.tweet)
        setAiScore(data.aiScore)
        toast({
          title: "Success",
          description: "Tweet generated successfully!"
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tweet from text",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateTweetFromImage = async () => {
    if (!uploadedImage) {
      toast({
        title: "Error",
        description: "Please upload an image",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append("image", uploadedImage)

      const response = await fetch("/api/tweets/generate-from-image", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setGeneratedTweet(data.tweet)
        setAiScore(data.aiScore)
        toast({
          title: "Success",
          description: "Tweet generated successfully!"
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate tweet from image",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const saveTweet = async () => {
    if (!generatedTweet.trim()) {
      toast({
        title: "Error",
        description: "No tweet to save",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          content: generatedTweet,
          source: "manual",
          sourceUrl: activeTab === "link" ? linkUrl : "",
          sourceTitle: "Manual Creation",
          aiScore: aiScore || 8.0,
          status: autoPost ? "approved" : "pending"
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: autoPost ? "Tweet saved and scheduled for posting!" : "Tweet saved to pending list!"
        })

        // Reset form
        setGeneratedTweet("")
        setAiScore(null)
        setTweetLength(null)
        setLinkUrl("")
        setCustomText("")
        removeImage()

        // Navigate to tweets page to show the saved tweet
        try {
          router.push('/tweets')
        } catch (e) {
          /* ignore */
        }
      } else {
        throw new Error("Failed to save tweet")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save tweet",
        variant: "destructive"
      })
    }
  }

  const postTweetNow = async () => {
    if (!generatedTweet.trim()) {
      toast({
        title: "Error",
        description: "No tweet to post",
        variant: "destructive"
      })
      return
    }

    setIsPosting(true)
    try {
      const response = await fetch("/api/tweets/post-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedTweet,
          source: "manual",
          sourceUrl: activeTab === "link" ? linkUrl : "",
          sourceTitle: "Manual Creation",
          aiScore: aiScore || 8.0
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Tweet posted successfully!"
        })

        // Navigate to tweets page to refresh pending list and stats
        try { router.push('/tweets') } catch (e) { /* ignore */ }

        // Reset form
        setGeneratedTweet("")
        setAiScore(null)
        setTweetLength(null)
        setLinkUrl("")
        setCustomText("")
        removeImage()
      } else {
        throw new Error("Failed to post tweet")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post tweet",
        variant: "destructive"
      })
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <AuthWrapper>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Create Tweet</h1>
              <p className="text-muted-foreground mt-2">Generate AI-powered tweets from links, images, or text</p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-post"
                checked={autoPost}
                onCheckedChange={setAutoPost}
              />
              <Label htmlFor="auto-post" className="text-sm">
                Auto-post when saved
              </Label>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  AI Tweet Generator
                </CardTitle>
                <CardDescription>
                  Choose your input method and let AI create engaging tweets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="link" className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      Link
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Text
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url">Article URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="url"
                          placeholder="https://example.com/article"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                        />
                        <Button
                          onClick={generateTweetFromLink}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AI will analyze the article and create an engaging tweet
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload Image</Label>
                      {!imagePreview ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Click to upload or drag and drop
                          </p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="image-upload"
                          />
                          <Button variant="outline" asChild>
                            <label htmlFor="image-upload" className="cursor-pointer">
                              Choose Image
                            </label>
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={removeImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {imagePreview && (
                        <Button
                          onClick={generateTweetFromImage}
                          disabled={isGenerating}
                          className="w-full"
                        >
                          {isGenerating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing Image...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Generate Tweet
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text">Your Text</Label>
                      <Textarea
                        id="text"
                        placeholder="Enter your text, ideas, or topic..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        rows={4}
                      />
                      <Button
                        onClick={generateTweetFromText}
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Generate Tweet
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generated Tweet</span>
                  {aiScore && (
                    <Badge variant="outline" className="text-primary border-primary/20">
                      AI Score: {aiScore.toFixed(1)}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Review and edit your AI-generated tweet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedTweet ? (
                  <>
                    <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                      <Textarea
                        value={generatedTweet}
                        onChange={(e) => setGeneratedTweet(e.target.value)}
                        className="border-0 bg-transparent p-0 resize-none"
                        rows={4}
                      />
                      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                        <span>Characters: {tweetLength || generatedTweet.length}/280</span>
                        {(tweetLength || generatedTweet.length) > 280 && (
                          <span className="text-destructive">Too long!</span>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        onClick={saveTweet}
                        variant="outline"
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {autoPost ? "Save & Schedule" : "Save to Pending"}
                      </Button>
                      <Button
                        onClick={postTweetNow}
                        disabled={isPosting || generatedTweet.length > 280}
                        className="flex-1"
                      >
                        {isPosting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Post Now
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Your generated tweet will appear here</p>
                    <p className="text-sm">Use one of the input methods to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  )
}