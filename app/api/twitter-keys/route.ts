import type { NextRequest } from "next/server"
import { checkAuth } from "@/lib/auth"
import {
  firebaseApiKeysManager,
  decryptApiKey
} from "@/lib/firebase-api-keys"

export async function GET(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Get specific Twitter API key by ID
      const twitterKey = await firebaseApiKeysManager.getTwitterApiKeyById(id)
      if (!twitterKey) {
        return Response.json({ error: "Twitter API key not found" }, { status: 404 })
      }

      // Decrypt for display
      return Response.json({
        id: twitterKey.id,
        key_name: twitterKey.key_name,
        api_key: decryptApiKey(twitterKey.api_key),
        api_secret: decryptApiKey(twitterKey.api_secret),
        access_token: decryptApiKey(twitterKey.access_token),
        access_token_secret: decryptApiKey(twitterKey.access_token_secret),
        bearer_token: decryptApiKey(twitterKey.bearer_token),
        is_active: twitterKey.is_active,
        created_at: twitterKey.created_at,
        updated_at: twitterKey.updated_at,
        description: twitterKey.description,
        usage_count: twitterKey.usage_count,
        last_used: twitterKey.last_used,
      })
    } else {
      // Get all Twitter API keys
      const twitterKeys = await firebaseApiKeysManager.getAllTwitterApiKeys()

      // Don't return decrypted keys in list view for security
      return Response.json({
        twitterKeys: twitterKeys.map(key => ({
          id: key.id,
          key_name: key.key_name,
          is_active: key.is_active,
          created_at: key.created_at,
          updated_at: key.updated_at,
          description: key.description,
          usage_count: key.usage_count,
          last_used: key.last_used,
        }))
      })
    }
  } catch (error) {
    console.error("Failed to get Twitter API keys:", error)
    return Response.json({ error: "Failed to get Twitter API keys" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily disable auth for testing
    // if (!checkAuth(request)) {
    //   return Response.json({ error: "Authentication required" }, { status: 401 })
    // }

    const { key_name, api_key, api_secret, access_token, access_token_secret, bearer_token, is_active, description } = await request.json()

    // Validate required fields
    if (!key_name || !api_key || !api_secret || !access_token || !access_token_secret || !bearer_token) {
      return Response.json(
        { error: "All Twitter API key fields are required" },
        { status: 400 }
      )
    }

    const savedTwitterKey = await firebaseApiKeysManager.saveTwitterApiKey({
      key_name,
      api_key,
      api_secret,
      access_token,
      access_token_secret,
      bearer_token,
      is_active: is_active !== false,
      description: description || undefined,
    })

    console.log(`✅ Twitter API key saved: ${key_name}`)
    return Response.json({
      success: true,
      message: `Twitter API key saved: ${key_name}`,
      twitterKey: {
        id: savedTwitterKey.id,
        key_name: savedTwitterKey.key_name,
        is_active: savedTwitterKey.is_active,
        created_at: savedTwitterKey.created_at,
        updated_at: savedTwitterKey.updated_at,
        description: savedTwitterKey.description,
        usage_count: savedTwitterKey.usage_count,
      }
    })
  } catch (error) {
    console.error("Failed to save Twitter API key:", error)
    return Response.json({ error: "Failed to save Twitter API key" }, { status: 500 })
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
      return Response.json({ error: "Twitter API key ID is required" }, { status: 400 })
    }

    const success = await firebaseApiKeysManager.toggleTwitterApiKeyStatus(id, is_active)

    if (success) {
      console.log(`✅ Twitter API key status updated: ${id}`)
      return Response.json({ success: true, message: "Twitter API key status updated" })
    } else {
      return Response.json({ error: "Failed to update Twitter API key status" }, { status: 500 })
    }
  } catch (error) {
    console.error("Failed to update Twitter API key:", error)
    return Response.json({ error: "Failed to update Twitter API key" }, { status: 500 })
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
      return Response.json({ error: "Twitter API key ID is required" }, { status: 400 })
    }

    const success = await firebaseApiKeysManager.deleteTwitterApiKey(id)

    if (success) {
      console.log(`✅ Twitter API key deleted: ${id}`)
      return Response.json({ success: true, message: "Twitter API key deleted" })
    } else {
      return Response.json({ error: "Failed to delete Twitter API key" }, { status: 500 })
    }
  } catch (error) {
    console.error("Failed to delete Twitter API key:", error)
    return Response.json({ error: "Failed to delete Twitter API key" }, { status: 500 })
  }
}
