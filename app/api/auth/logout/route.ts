import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Clear the auth token cookie
    const response = Response.json({
      success: true,
      message: "Çıkış başarılı",
    })

    // Set cookie with Max-Age=0 to delete it
    response.headers.set(
      "Set-Cookie",
      `auth-token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
    )

    console.log("✅ User logged out")
    return response
  } catch (error) {
    console.error("Logout error:", error)
    return Response.json({ error: "Çıkış hatası" }, { status: 500 })
  }
}
