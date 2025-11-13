import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey, decryptApiKey } from '@/lib/firebase-api-keys'

export async function GET(request: NextRequest) {
  try {
    const testKey = "sk-1234567890abcdefghijklmnop"
    console.log(`🔐 Testing encryption...`)
    console.log(`Original key: "${testKey}"`)
    console.log(`Original length: ${testKey.length}`)

    const encrypted = encryptApiKey(testKey)
    console.log(`✅ Encrypted: "${encrypted}"`)
    console.log(`Encrypted length: ${encrypted.length}`)

    const decrypted = decryptApiKey(encrypted)
    console.log(`✅ Decrypted: "${decrypted}"`)
    console.log(`Decrypted length: ${decrypted.length}`)

    const matches = testKey === decrypted

    return NextResponse.json({
      success: matches,
      original: testKey,
      originalLength: testKey.length,
      encrypted: encrypted,
      encryptedLength: encrypted.length,
      decrypted: decrypted,
      decryptedLength: decrypted.length,
      matches: matches,
      testResult: matches ? "✅ PASS" : "❌ FAIL"
    })
  } catch (error) {
    console.error("❌ Encryption test error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
