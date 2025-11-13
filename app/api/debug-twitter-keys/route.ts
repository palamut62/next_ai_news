import { NextRequest, NextResponse } from 'next/server'
import { getActiveTwitterApiKey, decryptApiKey } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Checking Twitter API keys...')

    // Get active Twitter key
    const twitterKey = await getActiveTwitterApiKey()

    if (!twitterKey) {
      console.error('❌ No active Twitter API key found in Firebase')
      return NextResponse.json({
        success: false,
        error: 'No active Twitter API key found in Firebase',
        keyStatus: 'MISSING'
      }, { status: 400 })
    }

    console.log(`✅ Found active Twitter key: ${twitterKey.key_name}`)
    console.log(`Key ID: ${twitterKey.id}`)
    console.log(`Is Active: ${twitterKey.is_active}`)
    console.log(`Created At: ${twitterKey.created_at}`)
    console.log(`Usage Count: ${twitterKey.usage_count}`)

    // Try to decrypt the keys
    try {
      const decryptedApiKey = decryptApiKey(twitterKey.api_key)
      const decryptedApiSecret = decryptApiKey(twitterKey.api_secret)
      const decryptedAccessToken = decryptApiKey(twitterKey.access_token)
      const decryptedAccessTokenSecret = decryptApiKey(twitterKey.access_token_secret)
      const decryptedBearerToken = decryptApiKey(twitterKey.bearer_token)

      console.log('✅ All keys decrypted successfully')
      console.log(`API Key length: ${decryptedApiKey.length}`)
      console.log(`API Secret length: ${decryptedApiSecret.length}`)
      console.log(`Access Token length: ${decryptedAccessToken.length}`)
      console.log(`Access Token Secret length: ${decryptedAccessTokenSecret.length}`)
      console.log(`Bearer Token length: ${decryptedBearerToken.length}`)

      // Check key formats
      const checks = {
        api_key_valid: decryptedApiKey.length > 10,
        api_secret_valid: decryptedApiSecret.length > 10,
        access_token_valid: decryptedAccessToken.length > 10,
        access_token_secret_valid: decryptedAccessTokenSecret.length > 10,
        bearer_token_valid: decryptedBearerToken.length > 10,
        bearer_token_starts_with_bearer: decryptedBearerToken.startsWith('Bearer ')
      }

      return NextResponse.json({
        success: true,
        keyStatus: 'FOUND',
        keyName: twitterKey.key_name,
        keyId: twitterKey.id,
        isActive: twitterKey.is_active,
        usageCount: twitterKey.usage_count,
        lastUsed: twitterKey.last_used || 'Never',
        decryptionStatus: 'SUCCESS',
        keyValidationChecks: checks,
        keyLengths: {
          api_key: decryptedApiKey.length,
          api_secret: decryptedApiSecret.length,
          access_token: decryptedAccessToken.length,
          access_token_secret: decryptedAccessTokenSecret.length,
          bearer_token: decryptedBearerToken.length
        }
      })
    } catch (decryptError) {
      console.error('❌ Failed to decrypt keys:', decryptError)
      return NextResponse.json({
        success: false,
        error: 'Failed to decrypt API keys',
        keyStatus: 'FOUND_BUT_DECRYPT_FAILED',
        decryptionStatus: 'FAILED',
        errorDetails: decryptError instanceof Error ? decryptError.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name
    }, { status: 500 })
  }
}
