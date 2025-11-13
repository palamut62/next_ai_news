import { NextRequest, NextResponse } from 'next/server'
import { toggleTwitterApiKeyStatus, getTwitterApiKeys } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Switching to test keys...')

    // Get all keys
    const allKeys = await getTwitterApiKeys()
    console.log(`Found ${allKeys.length} keys in Firebase`)

    // Deactivate all except test keys
    const testKey = allKeys.find(k => k.key_name === "Test Keys - Direct")

    if (!testKey) {
      return NextResponse.json({
        success: false,
        error: "Test keys not found. Save them first using /api/save-test-keys"
      }, { status: 400 })
    }

    console.log(`✅ Found test key: ${testKey.id}`)

    // Deactivate other keys
    for (const key of allKeys) {
      if (key.id !== testKey.id && key.is_active) {
        console.log(`Deactivating key: ${key.key_name}`)
        await toggleTwitterApiKeyStatus(key.id, false)
      }
    }

    // Activate test key
    await toggleTwitterApiKeyStatus(testKey.id, true)
    console.log(`✅ Activated test key: ${testKey.key_name}`)

    return NextResponse.json({
      success: true,
      message: "Test keys activated successfully",
      activeKey: {
        id: testKey.id,
        key_name: testKey.key_name,
        is_active: true
      }
    })
  } catch (error) {
    console.error('❌ Error activating keys:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
