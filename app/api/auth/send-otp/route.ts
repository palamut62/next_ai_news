import type { NextRequest } from "next/server"
import { sendOTP, isValidAdminEmail } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return Response.json({ error: "E-posta adresi gerekli" }, { status: 400 })
    }

    // Check if email is valid admin email
    if (!isValidAdminEmail(email)) {
      return Response.json({ error: "Yetkisiz e-posta adresi" }, { status: 403 })
    }

    const sessionId = await sendOTP(email)

    if (!sessionId) {
      return Response.json({ error: "E-posta gönderimi başarısız" }, { status: 500 })
    }

    return Response.json({
      success: true,
      sessionId,
      message: "Doğrulama kodu e-posta adresinize gönderildi",
    })
  } catch (error) {
    console.error("Send OTP error:", error)
    return Response.json({ error: "Sunucu hatası" }, { status: 500 })
  }
}
