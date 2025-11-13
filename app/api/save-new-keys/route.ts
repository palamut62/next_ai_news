import { NextRequest, NextResponse } from 'next/server'
import { saveTwitterApiKey } from '@/lib/firebase-api-keys'

export async function POST(request: NextRequest) {
  try {
    // New keys with URL decoding (%3D = =, %2B = +)
    const newKeys = {
      key_name: "New Production Keys",
      api_key: "SlM9D5kc6YS6wYKnWJgD2YwMs",
      api_secret: "0LgmTFCauwHrosmX103vO63frDY5N0TVMHz0DGJyq2tU3mHOKK",
      access_token: "1112376994833010689-NTFlihJb9xiZyySNSAfnrPJxQpob77",
      access_token_secret: "DUvsddWCwqEQh8xJCTe6ndOHOSmguDgElUdmbGZ7EHtFy",
      // URL decode: %3D -> =
      bearer_token: "AAAAAAAAAAAAAAAAAAAAAB250QEAAAAAteXt4MDNV85umriMX39kGhs3cps=oH7a1j6EOunxSAUzLGyOq4369jmQG8lHQ2CC5202BWbuT5SU07",
      is_active: true,
      description: "New production API keys"
    }

    console.log('🔑 Saving new Twitter API keys to Firebase...')
    console.log('Key info:', {
      key_name: newKeys.key_name,
      api_key: newKeys.api_key.substring(0, 10) + '...',
      api_secret: newKeys.api_secret.substring(0, 10) + '...',
      access_token: newKeys.access_token.substring(0, 15) + '...',
      access_token_secret: newKeys.access_token_secret.substring(0, 10) + '...',
      bearer_token: newKeys.bearer_token.substring(0, 20) + '...'
    })

    const savedKey = await saveTwitterApiKey(newKeys)

    console.log('✅ New keys saved successfully!')
    console.log('Saved key ID:', savedKey.id)

    return NextResponse.json({
      success: true,
      message: "New API keys saved and activated successfully",
      savedKey: {
        id: savedKey.id,
        key_name: savedKey.key_name,
        is_active: savedKey.is_active,
        created_at: savedKey.created_at,
        usage_count: savedKey.usage_count
      }
    })
  } catch (error) {
    console.error('❌ Error saving new keys:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
