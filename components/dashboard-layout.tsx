import type React from "react"
import { AuthWrapper } from "@/components/auth-wrapper"
import { Sidebar } from "@/components/sidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthWrapper>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-64">
          <main className="p-6 md:p-8">{children}</main>
        </div>
      </div>
    </AuthWrapper>
  )
}
