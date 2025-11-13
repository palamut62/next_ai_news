import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"

const DEFAULT_SETTINGS = {
  apiUrl: "http://localhost:3000"
}

// Function to get settings from Firebase, fallback to file
async function getSettings() {
  try {
    // Try to get from Firebase
    if (db) {
      const settingsRef = collection(db, "settings")
      const q = query(settingsRef, where("type", "==", "app_settings"))
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const settingsDoc = snapshot.docs[0]
        console.log("✅ Settings loaded from Firebase")
        return settingsDoc.data()
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to load settings from Firebase:", error)
  }

  // Fallback to file
  try {
    const settingsFile = path.join(process.cwd(), "data", "settings.json")
    const settingsData = await fs.readFile(settingsFile, "utf8")
    console.log("✅ Settings loaded from file")
    return JSON.parse(settingsData)
  } catch (error) {
    console.log("⚠️ Using default settings")
    return DEFAULT_SETTINGS
  }
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable authentication for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const body = await request.json()
    const { content, source, sourceUrl, sourceTitle, aiScore, status } = body

    if (!content || content.trim().length === 0) {
      return Response.json({ error: "Tweet content is required" }, { status: 400 })
    }

    if (content.length > 280) {
      return Response.json({ error: "Tweet too long (max 280 characters)" }, { status: 400 })
    }

    // Get server URL from settings
    const settings = await getSettings()
    const serverUrl = settings.apiUrl || "http://localhost:3000"

    // Forward to the main tweets API with save action
    const tweetsResponse = await fetch(`${serverUrl}/api/tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        action: 'save',
        content,
        source: source || "manual",
        sourceUrl: sourceUrl || "",
        sourceTitle: sourceTitle || "Manual Creation",
        aiScore: aiScore || 8.0,
        status: status || "pending"
      })
    })

    if (!tweetsResponse.ok) {
      const errorData = await tweetsResponse.json()
      return Response.json(errorData, { status: tweetsResponse.status })
    }

    const data = await tweetsResponse.json()
    return Response.json(data)

  } catch (error) {
    console.error("Save tweet error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}