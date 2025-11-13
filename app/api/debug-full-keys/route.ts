import { NextRequest, NextResponse } from 'next/server'
import { getActiveTwitterApiKey, decryptApiKey } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    const twitterKey = await getActiveTwitterApiKey()

    if (!twitterKey) {
      return NextResponse.json({
        success: false,
        error: "No active Twitter API key found"
      }, { status: 400 })
    }

    const API_KEY = decryptApiKey(twitterKey.api_key)
    const API_SECRET = decryptApiKey(twitterKey.api_secret)
    const ACCESS_TOKEN = decryptApiKey(twitterKey.access_token)
    const ACCESS_TOKEN_SECRET = decryptApiKey(twitterKey.access_token_secret)
    const BEARER_TOKEN = decryptApiKey(twitterKey.bearer_token)

    console.log('🔐 Full key debug:')
    console.log('API_KEY:', API_KEY)
    console.log('API_SECRET:', API_SECRET)
    console.log('ACCESS_TOKEN:', ACCESS_TOKEN)
    console.log('ACCESS_TOKEN_SECRET:', ACCESS_TOKEN_SECRET)
    console.log('BEARER_TOKEN:', BEARER_TOKEN.substring(0, 50) + '...')

    return NextResponse.json({
      success: true,
      keyName: twitterKey.key_name,
      fullKeys: {
        api_key: API_KEY,
        api_secret: API_SECRET,
        access_token: ACCESS_TOKEN,
        access_token_secret: ACCESS_TOKEN_SECRET,
        bearer_token: BEARER_TOKEN.substring(0, 50) + '... (total: ' + BEARER_TOKEN.length + ' chars)'
      },
      keyLengths: {
        api_key: API_KEY.length,
        api_secret: API_SECRET.length,
        access_token: ACCESS_TOKEN.length,
        access_token_secret: ACCESS_TOKEN_SECRET.length,
        bearer_token: BEARER_TOKEN.length
      },
      validation: {
        api_key_valid: API_KEY.length === 25,
        api_secret_valid: API_SECRET.length === 50,
        access_token_valid: ACCESS_TOKEN.length === 50,
        access_token_secret_valid: ACCESS_TOKEN_SECRET.length === 45,
        bearer_token_valid: BEARER_TOKEN.length > 100
      }
    })
  } catch (error) {
    console.error('❌ Debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
