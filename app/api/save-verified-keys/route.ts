import { NextRequest, NextResponse } from 'next/server'
import { saveTwitterApiKey } from '@/lib/firebase-api-keys'

export async function POST(request: NextRequest) {
  try {
    // Verified keys - properly decoded (%3D = =)
    const verifiedKeys = {
      key_name: "Verified Production Keys",
      api_key: "SlM9D5kc6YS6wYKnWJgD2YwMs",
      api_secret: "0LgmTFCauwHrosmX103vO63frDY5N0TVMHz0DGJyq2tU3mHOKK",
      access_token: "1112376994833010689-NTFlihJb9xiZyySNSAfnrPJxQpob77",
      access_token_secret: "DUvsddWCwqEQh8xJCTe6ndOHOSmguDgElUdmbGZ7EHtFy",
      // Decode %3D to =
      bearer_token: "AAAAAAAAAAAAAAAAAAAAAB250QEAAAAAteXt4MDNV85umriMX39kGhs3cps=oH7a1j6EOunxSAUzLGyOq4369jmQG8lHQ2CC5202BWbuT5SU07",
      is_active: true,
      description: "Verified production API keys"
    }

    console.log('🔑 Saving verified Twitter API keys to Firebase...')
    console.log('Key info:', {
      api_key: verifiedKeys.api_key.substring(0, 10) + '... (length: ' + verifiedKeys.api_key.length + ')',
      api_secret: verifiedKeys.api_secret.substring(0, 10) + '... (length: ' + verifiedKeys.api_secret.length + ')',
      access_token: verifiedKeys.access_token.substring(0, 15) + '... (length: ' + verifiedKeys.access_token.length + ')',
      access_token_secret: verifiedKeys.access_token_secret.substring(0, 10) + '... (length: ' + verifiedKeys.access_token_secret.length + ')',
      bearer_token: verifiedKeys.bearer_token.substring(0, 20) + '... (length: ' + verifiedKeys.bearer_token.length + ')'
    })

    const savedKey = await saveTwitterApiKey(verifiedKeys)

    console.log('✅ Verified keys saved successfully!')
    console.log('Saved key ID:', savedKey.id)

    return NextResponse.json({
      success: true,
      message: "Verified production keys saved and activated",
      savedKey: {
        id: savedKey.id,
        key_name: savedKey.key_name,
        is_active: savedKey.is_active,
        created_at: savedKey.created_at
      }
    })
  } catch (error) {
    console.error('❌ Error saving verified keys:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
