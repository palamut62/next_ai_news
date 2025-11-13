import { NextRequest, NextResponse } from 'next/server'
import { toggleTwitterApiKeyStatus, getTwitterApiKeys } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Cleaning up Twitter API keys...')

    const allKeys = await getTwitterApiKeys()
    console.log(`Found ${allKeys.length} keys total`)

    // Find new production key
    const newKey = allKeys.find(k => k.key_name === "New Production Keys")

    if (!newKey) {
      return NextResponse.json({
        success: false,
        error: "New Production Keys not found"
      }, { status: 400 })
    }

    console.log(`✅ Found New Production Keys: ${newKey.id}`)

    // Deactivate ALL other keys
    let deactivatedCount = 0
    for (const key of allKeys) {
      if (key.id !== newKey.id) {
        console.log(`🔄 Deactivating: ${key.key_name}`)
        await toggleTwitterApiKeyStatus(key.id, false)
        deactivatedCount++
      }
    }

    // Make sure new key is active
    if (!newKey.is_active) {
      console.log('🔄 Activating New Production Keys')
      await toggleTwitterApiKeyStatus(newKey.id, true)
    }

    console.log(`✅ Cleanup complete: Deactivated ${deactivatedCount} keys`)

    return NextResponse.json({
      success: true,
      message: `Cleanup successful: kept "New Production Keys" active, deactivated ${deactivatedCount} other keys`,
      activeKey: {
        id: newKey.id,
        key_name: newKey.key_name
      }
    })
  } catch (error) {
    console.error('❌ Cleanup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
