"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { MessageSquare, Play, TrendingUp, AlertCircle } from "lucide-react"

type NewsArticle = {
  title: string
  description: string
  url: string
  urlToImage: string | null
  publishedAt: string
  source: { name: string }
}

export function QuickActions() {
  const [isRunning, setIsRunning] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleRunManualScan = async () => {
    if (isRunning) return
    setIsRunning(true)
    try {
      // 1) Use sample articles for testing (to avoid fetch-ai-news issues)
      const articles: NewsArticle[] = [
        {
          title: "AI Breakthrough: New Model Shows Promise",
          description: "A new artificial intelligence model demonstrates promising capabilities in natural language processing",
          url: "https://example.com/ai-news-1",
          source: { name: "AI Daily" }
        },
        {
          title: "Machine Learning Advances in Healthcare",
          description: "Researchers have developed new machine learning algorithms for medical diagnosis",
          url: "https://example.com/ai-news-2",
          source: { name: "Tech News" }
        }
      ]

      // 2) Generate tweets from those articles
      const genRes = await fetch("/api/news/generate-tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ articles }),
      })

      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err?.error || "Tweet oluşturma başarısız")
      }

      // Safe JSON parse for generate tweets response
      let genData
      const genResponseText = await genRes.text()
      try {
        genData = JSON.parse(genResponseText)
      } catch (parseError) {
        console.error("Generate Tweets JSON Parse Error:", parseError)
        console.error("Generate Tweets Response Text:", genResponseText.slice(0, 500))
        throw new Error("Invalid JSON response from generate tweets API")
      }
      const generated = genData?.generated || 0

      toast({
        title: "Manuel tarama tamamlandı",
        description: `${generated} tweet üretildi. İncelemek için Tweets sayfasına gidin.`,
      })

      // Optional: navigate to tweets list to review
      router.push("/tweets")
    } catch (error: any) {
      toast({
        title: "İşlem başarısız",
        description: error?.message || "Bilinmeyen bir hata oluştu",
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => router.push("/tweets")}> 
        <MessageSquare className="h-4 w-4 mr-2" />
        Review Pending Tweets
      </Button>
      <Button className="w-full justify-start" variant={isRunning ? "secondary" : "outline"} onClick={handleRunManualScan} disabled={isRunning}>
        <Play className="h-4 w-4 mr-2" />
        {isRunning ? "Running Scan..." : "Run Manual Scan"}
      </Button>
      <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => router.push("/statistics")}> 
        <TrendingUp className="h-4 w-4 mr-2" />
        View Analytics
      </Button>
      <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => router.push("/notifications")}> 
        <AlertCircle className="h-4 w-4 mr-2" />
        Check System Status
      </Button>
    </div>
  )
}

