import type { NextRequest } from "next/server"
import { SignJWT } from "jose"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

// Hardcoded users as fallback
const VALID_USERS = [
  { username: "admin", password: "admin123", email: "" },
  { username: "user", password: "user123", email: "" },
]

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe } = await request.json()

    if (!username || !password) {
      return Response.json({ error: "Kullanıcı adı ve şifre gerekli" }, { status: 400 })
    }

    let user = null
    let email = ""

    // First, try to find user in Firestore
    try {
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("username", "==", username))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data()
        // Check password (WARNING: in production use bcrypt!)
        if (userData.password === password) {
          user = { username: userData.username, email: userData.email || "" }
          email = userData.email || ""
        }
      }
    } catch (firebaseError) {
      console.warn("Firebase user lookup failed, using fallback:", firebaseError)
    }

    // Fallback to hardcoded users if Firestore fails or user not found
    if (!user) {
      const hardcodedUser = VALID_USERS.find(
        (u) => u.username === username && u.password === password
      )
      if (hardcodedUser) {
        user = hardcodedUser
        email = hardcodedUser.email
      }
    }

    if (!user) {
      return Response.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 401 })
    }

    // Create JWT token
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
    )

    const token = await new SignJWT({ username: user.username, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(rememberMe ? "30d" : "24h")
      .sign(secret)

    // Set cookie
    const response = Response.json({
      success: true,
      message: "Giriş başarılı",
      user: { username: user.username, email },
    })

    response.headers.set(
      "Set-Cookie",
      `auth-token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${
        rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60
      }`
    )

    console.log(`✅ User logged in: ${username}`)
    return response
  } catch (error) {
    console.error("Login error:", error)
    return Response.json({ error: "Giriş hatası" }, { status: 500 })
  }
}
