import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import { firebaseApiKeysManager } from "@/lib/firebase-api-keys"

export async function GET(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    if (service) {
      // Get specific API key
      const apiKey = await firebaseApiKeysManager.getApiKey(service)
      if (!apiKey) {
        return Response.json({ error: "API key not found" }, { status: 404 })
      }
      return Response.json(apiKey)
    } else {
      // Get all API keys
      const apiKeys = await firebaseApiKeysManager.getAllApiKeys()
      return Response.json({ apiKeys })
    }
  } catch (error) {
    console.error("Failed to get API keys:", error)
    return Response.json({ error: "Failed to get API keys" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { service, key_name, api_key, is_active, description } = await request.json()

    if (!service || !key_name || !api_key) {
      return Response.json(
        { error: "Service, key name, and API key are required" },
        { status: 400 }
      )
    }

    const savedApiKey = await firebaseApiKeysManager.saveApiKey({
      service,
      key_name,
      api_key,
      is_active: is_active !== false,
      description: description || undefined,
    })

    console.log(`✅ API key saved for service: ${service}`)
    return Response.json({
      success: true,
      message: `API key saved for ${service}`,
      apiKey: {
        ...savedApiKey,
        api_key: "***" // Don't return full key to client
      }
    })
  } catch (error) {
    console.error("Failed to save API key:", error)
    return Response.json({ error: "Failed to save API key" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { id, is_active } = await request.json()

    if (!id) {
      return Response.json({ error: "API key ID is required" }, { status: 400 })
    }

    const success = await firebaseApiKeysManager.toggleApiKeyStatus(id, is_active)

    if (success) {
      console.log(`✅ API key status updated: ${id}`)
      return Response.json({ success: true, message: "API key status updated" })
    } else {
      return Response.json({ error: "Failed to update API key status" }, { status: 500 })
    }
  } catch (error) {
    console.error("Failed to update API key:", error)
    return Response.json({ error: "Failed to update API key" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return Response.json({ error: "API key ID is required" }, { status: 400 })
    }

    const success = await firebaseApiKeysManager.deleteApiKey(id)

    if (success) {
      console.log(`✅ API key deleted: ${id}`)
      return Response.json({ success: true, message: "API key deleted" })
    } else {
      return Response.json({ error: "Failed to delete API key" }, { status: 500 })
    }
  } catch (error) {
    console.error("Failed to delete API key:", error)
    return Response.json({ error: "Failed to delete API key" }, { status: 500 })
  }
}
