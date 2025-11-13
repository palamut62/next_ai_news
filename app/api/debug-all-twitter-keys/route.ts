import { NextRequest, NextResponse } from 'next/server'
import { getTwitterApiKeys } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Fetching all Twitter API keys from Firebase...')

    const allKeys = await getTwitterApiKeys()

    console.log(`📊 Found ${allKeys.length} Twitter API keys in Firebase`)

    if (allKeys.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Twitter API keys found in Firebase',
        totalKeys: 0,
        message: 'You need to add at least one Twitter API key from the API Keys management page'
      }, { status: 400 })
    }

    // Map the keys without revealing actual secrets
    const keySummary = allKeys.map(key => ({
      id: key.id,
      key_name: key.key_name,
      is_active: key.is_active,
      created_at: key.created_at,
      updated_at: key.updated_at,
      usage_count: key.usage_count,
      last_used: key.last_used || 'Never',
      description: key.description || 'No description'
    }))

    const activeKey = allKeys.find(k => k.is_active)

    return NextResponse.json({
      success: true,
      totalKeys: allKeys.length,
      activeKeyExists: !!activeKey,
      activeKeyName: activeKey?.key_name || 'None',
      activeKeyId: activeKey?.id || null,
      keys: keySummary
    })
  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name
    }, { status: 500 })
  }
}
