"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bot, Home, MessageSquare, Settings, BarChart3, Github, Bell, Menu, X, Plus, Newspaper, Key, LogOut, User, ChevronDown } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Create Tweet", href: "/create", icon: Plus },
  { name: "Pending Tweets", href: "/tweets", icon: MessageSquare },
  { name: "TechCrunch News", href: "/techcrunch", icon: Newspaper },
  { name: "Statistics", href: "/statistics", icon: BarChart3 },
  { name: "GitHub Repos", href: "/github", icon: Github },
  { name: "API Keys", href: "/api-keys", icon: Key },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Notifications", href: "/notifications", icon: Bell },
]

interface UserInfo {
  username: string
  email?: string
  provider: string
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Fetch user info
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/auth/check", {
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user) {
            setUser(data.user)
          }
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error)
      }
    }

    fetchUserInfo()
  }, [])

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })

      if (response.ok) {
        // Reload the page to show login screen
        window.location.href = "/"
      }
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const getUserInitials = () => {
    if (!user) return "U"
    return user.username.substring(0, 2).toUpperCase()
  }

  const getProviderIcon = () => {
    if (user?.provider === "google") return "🔐"
    return "👤"
  }

  const getAvatarColor = () => {
    if (!user) return "bg-slate-400"
    const hash = user.username.charCodeAt(0) + user.username.charCodeAt(1)
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
    ]
    return colors[hash % colors.length]
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
            <img
              src="/logo.png"
              alt="AI Tweet Bot Logo"
              className="h-8 w-auto"
            />
            <span className="ml-3 text-lg font-semibold text-sidebar-foreground">AI Tweet Bot</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-sidebar-border">
            {user ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2 py-4 h-auto hover:bg-sidebar-accent"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Avatar className={`h-12 w-12 ${getAvatarColor()}`}>
                      <AvatarFallback className="text-white font-bold text-lg">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-sidebar-foreground truncate">
                          {user.username}
                        </span>
                        <span className="text-xs flex-shrink-0">{getProviderIcon()}</span>
                      </div>
                      {user.email ? (
                        <div className="text-xs text-sidebar-foreground/70 truncate">
                          {user.email}
                        </div>
                      ) : (
                        <div className="text-xs text-sidebar-foreground/50">Şifre ile giriş</div>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-sidebar-foreground/60 flex-shrink-0 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                  </div>
                </Button>

                {/* Profile Menu */}
                {isProfileOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <Avatar className={`h-10 w-10 ${getAvatarColor()}`}>
                          <AvatarFallback className="text-white font-bold text-sm">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.username}</p>
                          {user.email && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Ayarlar
                      </Link>
                      <Link
                        href="/api-keys"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Key className="h-4 w-4" />
                        API Keys
                      </Link>
                    </div>

                    <div className="border-t border-gray-200 dark:border-slate-700 py-2">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-sidebar-foreground/60">AI Tweet Bot v1.0</div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
