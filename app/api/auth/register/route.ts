import type { NextRequest } from "next/server"
import { SignJWT } from "jose"
import { db } from "@/lib/firebase"
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json()

    if (!username || !password) {
      return Response.json(
        { error: "Kullanıcı adı ve şifre gerekli" },
        { status: 400 }
      )
    }

    // Check if username already exists
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("username", "==", username))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      return Response.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
        { status: 400 }
      )
    }

    // Create new user (in production, hash the password!)
    const newUser = {
      username,
      password, // WARNING: In production, use bcrypt or similar to hash!
      email: email || "",
      created_at: new Date().toISOString(),
      provider: "username",
    }

    await addDoc(usersRef, newUser)

    // Create JWT token
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
    )

    const token = await new SignJWT({ username, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret)

    // Set cookie
    const response = Response.json({
      success: true,
      message: "Kayıt başarılı",
      user: { username, email },
    })

    response.headers.set(
      "Set-Cookie",
      `auth-token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${
        30 * 24 * 60 * 60
      }`
    )

    console.log(`✅ New user registered: ${username}`)
    return response
  } catch (error: any) {
    console.error("Registration error:", error)

    // Check if it's a Firebase error
    if (error?.code === 'permission-denied') {
      return Response.json(
        { error: "Firebase izin hatası. Lütfen Firebase Console'da Firestore kurallarını kontrol edin." },
        { status: 500 }
      )
    }

    return Response.json(
      { error: error?.message || "Kayıt hatası" },
      { status: 500 }
    )
  }
}
