import { auth } from './firebase'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
  getIdToken,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()

// Add Google scopes if needed
googleProvider.addScope('profile')
googleProvider.addScope('email')

// Auto-initialize anonymous auth for Firestore access (optional)
let authInitialized = false

export async function initializeAnonymousAuth(): Promise<User | null> {
  // This is now optional - Firebase Anonymous Auth is not required for the app to work
  // Users can still login with username/password or Google without Firebase Auth
  return null
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    console.log('✅ Signed in with Google:', result.user.email)
    return result.user
  } catch (error) {
    console.error('❌ Google sign-in error:', error)
    throw error
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth)
    console.log('✅ Signed out successfully')
  } catch (error) {
    console.error('❌ Sign out error:', error)
    throw error
  }
}

export async function getCurrentUser(): Promise<User | null> {
  return auth.currentUser
}

export async function getAuthToken(): Promise<string | null> {
  if (!auth.currentUser) return null
  try {
    return await getIdToken(auth.currentUser)
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export async function isUserAuthenticated(): Promise<boolean> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(!!user)
    })
  })
}
