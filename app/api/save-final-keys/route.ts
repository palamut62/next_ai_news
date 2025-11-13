import { NextRequest, NextResponse } from 'next/server'
import { saveTwitterApiKey } from '@/lib/firebase-api-keys'

export async function POST(request: NextRequest) {
  try {
    // Final production keys - URL decoded (%3D = =)
    const finalKeys = {
      key_name: "Production Keys v2",
      api_key: "SlM9D5kc6YS6wYKnWJgD2YwMs",
      api_secret: "0LgmTFCauwHrosmX103vO63frDY5N0TVMHz0DGJyq2tU3mHOKK",
      access_token: "1112376994833010689-NTFlihJb9xiZyySNSAfnrPJxQpob77",
      access_token_secret: "DUvsddWCwqEQh8xJCTe6ndOHOSmguDgElUdmbGZ7EHtFy",
      bearer_token: "AAAAAAAAAAAAAAAAAAAAAB250QEAAAAAteXt4MDNV85umriMX39kGhs3cps=oH7a1j6EOunxSAUzLGyOq4369jmQG8lHQ2CC5202BWbuT5SU07",
      is_active: true,
      description: "Final production API keys"
    }

    console.log('🔑 Saving final production Twitter API keys to Firebase...')
    console.log('Key details:', {
      key_name: finalKeys.key_name,
      api_key_length: finalKeys.api_key.length,
      api_secret_length: finalKeys.api_secret.length,
      access_token_length: finalKeys.access_token.length,
      access_token_secret_length: finalKeys.access_token_secret.length,
      bearer_token_length: finalKeys.bearer_token.length
    })

    const savedKey = await saveTwitterApiKey(finalKeys)

    console.log('✅ Final keys saved successfully!')

    return NextResponse.json({
      success: true,
      message: "Final production keys saved to Firebase",
      savedKey: {
        id: savedKey.id,
        key_name: savedKey.key_name,
        is_active: savedKey.is_active,
        created_at: savedKey.created_at
      },
      credentials: {
        api_key: finalKeys.api_key,
        api_secret: finalKeys.api_secret,
        access_token: finalKeys.access_token,
        access_token_secret: finalKeys.access_token_secret,
        bearer_token: finalKeys.bearer_token.substring(0, 50) + '...'
      }
    })
  } catch (error) {
    console.error('❌ Error saving final keys:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
