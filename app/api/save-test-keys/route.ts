import { NextRequest, NextResponse } from 'next/server'
import { saveTwitterApiKey } from '@/lib/firebase-api-keys'

export async function POST(request: NextRequest) {
  try {
    const testKeys = {
      key_name: "Test Keys - Direct",
      api_key: "pIrAwognYFtV3zMrjVuz2dp1z",
      api_secret: "yTtMf4raIEdy8XWwQ3E8qmvLIGkW0gpqhPOmnKw6vRdKhKARW5",
      access_token: "1112376994833010689-IZOjwuI7Cu0HAWZFY7VbX8pShzYkIm",
      access_token_secret: "EghC7ufEdg1xMhIKPOQ8TNv9PcHDNO5wymfWhpr3kPwSC",
      bearer_token: "AAAAAAAAAAAAAAAAAAAAAB250QEAAAAAAbe07vXgivwWfE%2BdjJvmBt6OCHI%3D8F6VzTrm5OUcncrRSYHvBDkavjtZ0oLW1izBvlzOGxgUFiTvXQ",
      is_active: true,
      description: "Test keys for direct testing"
    }

    console.log('🔑 Saving test Twitter API keys to Firebase...')
    console.log('Key details:', {
      key_name: testKeys.key_name,
      api_key_length: testKeys.api_key.length,
      api_secret_length: testKeys.api_secret.length,
      access_token_length: testKeys.access_token.length,
      access_token_secret_length: testKeys.access_token_secret.length,
      bearer_token_length: testKeys.bearer_token.length
    })

    const savedKey = await saveTwitterApiKey(testKeys)

    console.log('✅ Test keys saved successfully!')
    console.log('Saved key ID:', savedKey.id)

    return NextResponse.json({
      success: true,
      message: "Test keys saved successfully to Firebase",
      savedKey: {
        id: savedKey.id,
        key_name: savedKey.key_name,
        is_active: savedKey.is_active,
        created_at: savedKey.created_at,
        usage_count: savedKey.usage_count
      }
    })
  } catch (error) {
    console.error('❌ Error saving test keys:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // For testing via browser
  return POST(request)
}
