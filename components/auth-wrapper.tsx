"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Mail, Bot, KeyRound } from "lucide-react"

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("umutcelik6230@gmail.com")
  const [otp, setOtp] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check", {
          credentials: "include",
        })
        if (response.ok) {
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error("Auth check failed:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSessionId(data.sessionId)
        setStep("otp")
        setCountdown(300) // 5 minutes countdown
      } else {
        setError(data.error || "E-posta gönderimi başarısız")
      }
    } catch (error) {
      setError("Bağlantı hatası")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, otp, rememberMe }),
        credentials: "include",
      })

      if (response.ok) {
        setIsAuthenticated(true)
      } else {
        const data = await response.json()
        setError(data.error || "Geçersiz kod")
      }
    } catch (error) {
      setError("Doğrulama başarısız")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (countdown > 0) return

    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSessionId(data.sessionId)
        setCountdown(300)
        setOtp("")
      } else {
        setError(data.error || "E-posta gönderimi başarısız")
      }
    } catch (error) {
      setError("Bağlantı hatası")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">AI Tweet Bot</CardTitle>
            <CardDescription>
              {step === "email" ? "E-posta adresinizi girin" : "E-postanıza gönderilen kodu girin"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta Adresi</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                {error && <div className="text-sm text-destructive">{error}</div>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  <Mail className="mr-2 h-4 w-4" />
                  {isLoading ? "Gönderiliyor..." : "Kod Gönder"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Doğrulama Kodu</Label>
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                    required
                  />
                  <p className="text-xs text-muted-foreground text-center">{email} adresine gönderildi</p>
                </div>
                {error && <div className="text-sm text-destructive">{error}</div>}
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground">
                    30 gün beni hatırla
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isLoading ? "Doğrulanıyor..." : "Giriş Yap"}
                </Button>
                <div className="text-center space-y-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep("email")} className="text-xs">
                    E-posta adresini değiştir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOTP}
                    disabled={countdown > 0 || isLoading}
                    className="text-xs"
                  >
                    {countdown > 0
                      ? `Tekrar gönder (${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")})`
                      : "Kodu tekrar gönder"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
