import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (checkAuth(request)) {
    return new Response("Authenticated", { status: 200 })
  }

  return new Response("Not authenticated", { status: 401 })
}
