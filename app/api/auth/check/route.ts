import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { jwtVerify } from "jose"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request)

  if (!authResult.authenticated) {
    return Response.json({ authenticated: false }, { status: 401 })
  }

  // Try to get user info from JWT token
  const cookie = request.headers.get("cookie") || ""
  const cookies = Object.fromEntries(
    cookie.split(';').map(cookie => {
      const [key, value] = cookie.trim().split('=')
      return [key, value]
    })
  )

  const jwtToken = cookies['auth-token']

  if (jwtToken) {
    try {
      const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
      )
      const { payload } = await jwtVerify(jwtToken, secret)

      // Return user info from JWT
      return Response.json({
        authenticated: true,
        user: {
          username: payload.username as string || "User",
          provider: payload.provider as string || "username",
          email: payload.email as string,
        }
      })
    } catch (error) {
      // JWT invalid, but auth passed - might be old system
    }
  }

  // Fallback for old session system
  return Response.json({
    authenticated: true,
    user: {
      username: "User",
      email: authResult.email,
      provider: "legacy"
    }
  })
}
