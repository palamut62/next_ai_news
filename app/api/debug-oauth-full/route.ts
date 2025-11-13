import { NextRequest, NextResponse } from 'next/server'
import { getActiveTwitterApiKey, decryptApiKey } from '@/lib/firebase-api-keys'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 FULL OAuth Debug...')

    const twitterKey = await getActiveTwitterApiKey()

    if (!twitterKey) {
      return NextResponse.json({ success: false, error: "No active key" }, { status: 400 })
    }

    const API_KEY = decryptApiKey(twitterKey.api_key)
    const API_SECRET = decryptApiKey(twitterKey.api_secret)
    const ACCESS_TOKEN = decryptApiKey(twitterKey.access_token)
    const ACCESS_TOKEN_SECRET = decryptApiKey(twitterKey.access_token_secret)

    console.log('📝 Credentials:')
    console.log('  API_KEY:', API_KEY)
    console.log('  API_SECRET:', API_SECRET)
    console.log('  ACCESS_TOKEN:', ACCESS_TOKEN)
    console.log('  ACCESS_TOKEN_SECRET:', ACCESS_TOKEN_SECRET)

    const testTweet = "🧪 Test tweet"

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

    console.log('🔑 Creating OAuth auth...')
    const authHeader = oauth.toHeader(oauth.authorize(request_data, token))

    console.log('✅ Auth Header Generated:')
    console.log(authHeader)

    // Now test the actual request
    console.log('📤 Sending test request to Twitter...')
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: testTweet }),
    })

    const status = response.status
    const statusText = response.statusText
    const responseText = await response.text()
    let responseData = null

    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = responseText
    }

    console.log('📥 Response:', status, statusText)
    console.log('Response body:', responseData)

    return NextResponse.json({
      success: status === 201,
      status,
      statusText,
      authHeader: {
        Authorization: authHeader.Authorization?.substring(0, 100) + '...',
        fullLength: authHeader.Authorization?.length
      },
      response: responseData,
      credentials: {
        api_key: API_KEY,
        api_secret: API_SECRET,
        access_token: ACCESS_TOKEN,
        access_token_secret: ACCESS_TOKEN_SECRET
      }
    })
  } catch (error) {
    console.error('❌ OAuth debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
