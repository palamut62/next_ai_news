import { NextRequest, NextResponse } from 'next/server'
import { getActiveTwitterApiKey, decryptApiKey } from '@/lib/firebase-api-keys'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 Debugging OAuth 1.0a signature...')

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

    console.log('Credentials loaded:')
    console.log('  API_KEY:', API_KEY)
    console.log('  API_SECRET:', API_SECRET)
    console.log('  ACCESS_TOKEN:', ACCESS_TOKEN)
    console.log('  ACCESS_TOKEN_SECRET:', ACCESS_TOKEN_SECRET)

    const testTweet = "🧪 Test OAuth signature"

    const oauth = new OAuth({
      consumer: { key: API_KEY, secret: API_SECRET },
      signature_method: "HMAC-SHA1",
      hash_function(base_string: string, key: string) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });

    const request_data = {
      url: "https://api.twitter.com/2/tweets",
      method: "POST",
      data: { text: testTweet },
    };

    const token = {
      key: ACCESS_TOKEN,
      secret: ACCESS_TOKEN_SECRET,
    };

    const authHeader = oauth.toHeader(oauth.authorize(request_data, token))

    console.log('Generated Auth Header:', authHeader)

    return NextResponse.json({
      success: true,
      keyName: twitterKey.key_name,
      credentials: {
        api_key: `${API_KEY.substring(0, 5)}...${API_KEY.substring(API_KEY.length - 3)}`,
        api_secret: `${API_SECRET.substring(0, 5)}...${API_SECRET.substring(API_SECRET.length - 3)}`,
        access_token: `${ACCESS_TOKEN.substring(0, 5)}...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 3)}`,
        access_token_secret: `${ACCESS_TOKEN_SECRET.substring(0, 5)}...${ACCESS_TOKEN_SECRET.substring(ACCESS_TOKEN_SECRET.length - 3)}`
      },
      credentialLengths: {
        api_key: API_KEY.length,
        api_secret: API_SECRET.length,
        access_token: ACCESS_TOKEN.length,
        access_token_secret: ACCESS_TOKEN_SECRET.length
      },
      authHeaderLength: authHeader.Authorization?.length,
      authHeaderSample: authHeader.Authorization?.substring(0, 100) + '...',
      testTweet: testTweet
    })
  } catch (error) {
    console.error('❌ Debug OAuth error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
