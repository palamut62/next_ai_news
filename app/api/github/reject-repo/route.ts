import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { supabaseStorage } from "@/lib/supabase-storage"
import { logAPIEvent } from "@/lib/audit-logger"

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // const auth = await checkAuth(request)
    // if (!auth.authenticated) {
    //   await logAPIEvent('reject_repo_auth_failure', false, request, {
    //     url: request.url,
    //     method: request.method
    //   })
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    let repo
    try {
      const body = await request.json()
      repo = body.repo
    } catch (jsonError) {
      return Response.json({ error: "Invalid JSON data" }, { status: 400 })
    }

    if (!repo || !repo.fullName || !repo.url) {
      return Response.json({ error: "Repository with full name and URL is required" }, { status: 400 })
    }

    // Add to rejected repositories
    await supabaseStorage.addRejectedGitHubRepo({
      fullName: repo.fullName,
      url: repo.url,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stars || 0,
      reason: 'user_rejected'
    })

    await logAPIEvent('github_repo_rejected', true, request, {
      repoFullName: repo.fullName,
      repoUrl: repo.url,
      language: repo.language,
      userEmail: 'test-user@example.com'
    })

    return Response.json({
      success: true,
      message: "Repository rejected successfully",
      repoName: repo.fullName
    })

  } catch (error) {
    console.error("Reject GitHub repo error:", error)
    await logAPIEvent('reject_repo_error', false, request, {
      error: error instanceof Error ? error.message : 'Unknown error',
      repoFullName: repo?.fullName
    })
    return Response.json({ error: "Failed to reject repository" }, { status: 500 })
  }
}