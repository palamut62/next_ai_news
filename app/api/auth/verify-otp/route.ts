import type { NextRequest } from "next/server"
import { verifyOTP } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { sessionId, otp, rememberMe } = await request.json()

    if (!sessionId || !otp) {
      return Response.json({ error: "Session ID ve OTP gerekli" }, { status: 400 })
    }

    const isValid = verifyOTP(sessionId, otp)

    if (!isValid) {
      return Response.json({ error: "Geçersiz veya süresi dolmuş kod" }, { status: 401 })
    }

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 days or 1 day

    return new Response("Login successful", {
      status: 200,
      headers: {
        "Set-Cookie": `auth=true; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=lax`,
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Verify OTP error:", error)
    return Response.json({ error: "Sunucu hatası" }, { status: 500 })
  }
}
