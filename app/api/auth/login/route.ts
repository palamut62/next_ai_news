import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  // This endpoint is deprecated - use /api/auth/send-otp and /api/auth/verify-otp instead
  return Response.json({ error: "Bu giriş yöntemi artık desteklenmiyor" }, { status: 410 })
}
