import type { NextRequest } from "next/server"
import { SignJWT } from "jose"

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json()

    if (!email || !displayName) {
      return Response.json(
        { error: "Email ve displayName gerekli" },
        { status: 400 }
      )
    }

    // Extract username from email (part before @)
    const username = email.split("@")[0]

    // Create JWT token with user info
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
    )

    const sessionToken = await new SignJWT({
      username,
      email,
      displayName,
      provider: "google",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret)

    // Set cookie
    const response = Response.json({
      success: true,
      message: "Google giriş başarılı",
      user: { username, email, displayName },
    })

    response.headers.set(
      "Set-Cookie",
      `auth-token=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${
        30 * 24 * 60 * 60
      }`
    )

    console.log(`✅ User logged in with Google: ${email}`)
    return response
  } catch (error) {
    console.error("Google login error:", error)
    return Response.json({ error: "Google giriş hatası" }, { status: 500 })
  }
}
