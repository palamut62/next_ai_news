# PRD: AI News Tweet App - Firebase + Next.js Architecture

**Versiyon:** 1.0
**Tarih:** Kasım 2025
**Durum:** Detailed Specification
**Hedef Platform:** Next.js 14 + JavaScript + Firebase + Vercel

---

## 1. EXECUTIVE SUMMARY

Bu dokument, mevcut Supabase/PostgreSQL tabanlı AI Tweet otomasyon uygulamasını **Firebase Realtime Database** veya **Firestore** kullanarak yeniden tasarlamak için kapsamlı bir rehber sunar.

### Avantajlar
✅ **Gerçek-zamanlı veri sinkronizasyonu** (Firestore Listeners)
✅ **Serverless mimarisi** (Cloud Functions)
✅ **Ölçeklenebilir Authentication** (Firebase Auth)
✅ **CDN optimizasyonu** (Cloud Storage)
✅ **Kullanıma göre ödeme modeli**
✅ **Vercel ile Native entegrasyon**

### Hedef Mimari
```
┌─────────────────────────────────────────────────────────┐
│                    NEXT.JS 14 (FRONTEND)                │
│  - React 18 + TypeScript + Tailwind + shadcn/ui        │
│  - Pages: Dashboard, Tweets, GitHub, Settings, etc     │
└─────────────────────────────────────────────────────────┘
              ↓                    ↓                    ↓
    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
    │ NEXT.JS API  │    │   FIREBASE   │    │  EXTERNAL   │
    │  ROUTES      │→→→ │  SERVICES    │←←← │    APIS     │
    │ (JavaScript) │    │              │    │             │
    └──────────────┘    └──────────────┘    └─────────────┘
                             ↓ ↓ ↓
         ┌───────────────────┼─┼─┼───────────────────┐
         ↓                   ↓ ↓ ↓                   ↓
    ┌─────────────┐  ┌──────────────┐    ┌──────────────┐
    │  FIRESTORE  │  │AUTH + STORAGE│    │CLOUD FUNCTIONS
    │  (Database) │  │              │    │(Automation)
    └─────────────┘  └──────────────┘    └──────────────┘
```

---

## 2. TECHNOLOGY STACK

### Frontend
| Bileşen | Teknoloji | Versiyon | Neden |
|---------|-----------|---------|-------|
| Framework | Next.js App Router | 14.2+ | React 18 support, best practices |
| Language | JavaScript + JSDoc | ES2024 | Lightweight, fast development |
| Styling | Tailwind CSS | 4.1+ | Utility-first CSS |
| UI Components | shadcn/ui + Radix UI | Latest | Accessible, customizable |
| Forms | React Hook Form + Zod | 7.0+ | Type-safe forms |
| Database | Firestore | Realtime | Real-time listeners, scalable |
| Authentication | Firebase Auth | Latest | OTP/Email support |
| Storage | Firebase Cloud Storage | Latest | Images, media files |
| Real-time | Firestore Listeners | Built-in | Auto-sync data |

### Backend (API Routes)
| Layer | Teknoloji | Neden |
|-------|-----------|-------|
| Runtime | Node.js 18+ | Next.js API routes |
| Language | JavaScript | Lightweight, TypeScript optional |
| Async | async/await | Native Promise support |
| Firebase SDK | Admin SDK | Server-side auth, security |
| Validation | Zod | Runtime type checking |
| Error Handling | Custom middleware | Consistent error responses |

### Backend (Cloud Functions - Optional)
| Use Case | Service | Neden |
|----------|---------|-------|
| Scheduled Tasks | Cloud Scheduler + Functions | Automatic tweet posting |
| Webhooks | HTTP Cloud Functions | Twitter, GitHub webhooks |
| Heavy Processing | Cloud Functions | AI batch processing |
| File Processing | Cloud Functions | Image analysis jobs |

### Database Schema
| Service | Purpose | Başlıca Koleksiyonlar |
|---------|---------|---------------------|
| **Firestore** | Primary NoSQL Database | tweets, articles, repos, settings, users |
| **Realtime DB** (Optional) | Real-time counters | engagement_stats (likes, RT count) |
| **Cloud Storage** | File Storage | user_avatars, tweet_images |

### External APIs (Same as Original)
```javascript
// No changes - same as Supabase version
- Twitter API v1.1 & v2 (OAuth 1.0a)
- GitHub API v3 & v4 (GraphQL optional)
- NewsAPI / TechCrunch RSS
- Google Gemini / OpenAI / Claude API
- Gmail SMTP (via nodemailer)
- Telegram Bot API
```

---

## 3. FIREBASE SERVICES BREAKDOWN

### 3.1 Firebase Authentication
```javascript
Services:
✓ Email/Password authentication
✓ OTP via Email (Firebase Auth + Custom)
✓ Anonymous authentication (for testing)
✓ Token refresh and session management

Implementation:
- Frontend: firebase/auth client SDK
- Backend: firebase-admin SDK for verification
- OTP: Custom function + Gmail service

Configuration:
{
  signInMethods: ['password', 'emailLink'],
  sessionDuration: '24 hours',
  otpExpiration: '5 minutes'
}
```

### 3.2 Firestore Database
```javascript
Structure:
firestore
├── users/
│   └── {userId}/
│       ├── email: string
│       ├── createdAt: timestamp
│       ├── apiUsage: {gemini, openai, claude}
│       └── preferences: {}
│
├── tweets/
│   └── {tweetId}/
│       ├── userId: string
│       ├── content: string
│       ├── status: 'pending'|'approved'|'posted'|'rejected'
│       ├── source: 'news'|'github'|'manual'
│       ├── sourceId: string
│       ├── createdAt: timestamp
│       ├── scheduledAt: timestamp
│       ├── postedAt: timestamp
│       ├── twitterId: string
│       ├── engagement: {likes, retweets, replies}
│       └── metadata: {}
│
├── articles/
│   └── {articleId}/
│       ├── title: string
│       ├── url: string
│       ├── source: 'techcrunch'|'newsapi'
│       ├── content: string
│       ├── publishedAt: timestamp
│       ├── tweetIds: [string]
│       ├── rejected: boolean
│       └── hash: string (for duplicate detection)
│
├── github_repos/
│   └── {repoId}/
│       ├── name: string
│       ├── fullName: string
│       ├── url: string
│       ├── stars: number
│       ├── language: string
│       ├── tweetIds: [string]
│       ├── rejected: boolean
│       └── fetchedAt: timestamp
│
├── settings/
│   └── {userId}/
│       ├── automation: {enabled, interval, minScore}
│       ├── github: {enabled, languages, minStars}
│       ├── notifications: {telegram, email}
│       ├── twitter: {apiKey, apiSecret, ...}
│       ├── ai: {provider, apiKey, model}
│       └── updatedAt: timestamp
│
├── api_keys/
│   └── {userId}/
│       ├── twitter: {encrypted_key, encrypted_secret}
│       ├── openai: {encrypted_key}
│       ├── gemini: {encrypted_key}
│       └── lastRotated: timestamp
│
├── notifications/
│   └── {notificationId}/
│       ├── userId: string
│       ├── type: string
│       ├── title: string
│       ├── message: string
│       ├── severity: 'info'|'success'|'warning'|'error'
│       ├── read: boolean
│       ├── createdAt: timestamp
│       └── metadata: {}
│
├── audit_logs/
│   └── {logId}/
│       ├── userId: string
│       ├── action: string
│       ├── resource: string
│       ├── changes: {}
│       ├── ipAddress: string
│       ├── timestamp: timestamp
│       └── status: 'success'|'failure'
│
└── engagement_stats/ (Realtime DB)
    └── {tweetId}/
        ├── likes: number
        ├── retweets: number
        ├── replies: number
        └── lastUpdated: timestamp
```

### 3.3 Cloud Storage
```javascript
Structure:
gs://project-bucket/
├── user_avatars/{userId}/profile.jpg
├── tweet_images/{tweetId}/image.jpg
├── temp_uploads/{sessionId}/file.*
└── exports/{userId}/tweets_export.csv
```

### 3.4 Cloud Functions (Optional but Recommended)
```javascript
Functions:
1. onTweetApproved()
   - Trigger: Firestore tweet.status → 'approved'
   - Action: Send notification, check schedule

2. onScheduledTweetTime()
   - Trigger: Cloud Scheduler (hourly)
   - Action: Check for scheduled tweets, post to Twitter

3. onTwitterEngagement()
   - Trigger: Cloud Scheduler (every 6 hours)
   - Action: Fetch engagement metrics, update Firestore

4. onArticleProcessed()
   - Trigger: Firestore article created
   - Action: Duplicate detection, hashtag generation

5. onUserCreated()
   - Trigger: Firebase Auth user created
   - Action: Create user profile, send welcome email

6. cleanupSessions()
   - Trigger: Cloud Scheduler (daily 2 AM)
   - Action: Delete expired sessions, tokens
```

### 3.5 Firestore Security Rules
```javascript
// Detailed rules in section 7

Key Principles:
✓ Users can only access their own data
✓ Admin role can access all data
✓ API keys encrypted and server-only
✓ Audit logs immutable
✓ Rate limiting per user
```

---

## 4. DIRECTORY STRUCTURE (Next.js 14)

```
ai-tweet-app/
│
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── send-otp/route.js
│   │   │   ├── verify-otp/route.js
│   │   │   ├── check/route.js
│   │   │   └── logout/route.js
│   │   │
│   │   ├── tweets/
│   │   │   ├── route.js (GET /tweets, POST /tweets)
│   │   │   ├── [tweetId]/route.js (GET/PATCH/DELETE)
│   │   │   ├── schedule/route.js
│   │   │   ├── post-now/route.js
│   │   │   ├── bulk-approve/route.js
│   │   │   └── auto-post/route.js
│   │   │
│   │   ├── news/
│   │   │   ├── fetch-ai-news/route.js
│   │   │   ├── generate-tweets/route.js
│   │   │   └── duplicate-stats/route.js
│   │   │
│   │   ├── github/
│   │   │   ├── repos/route.js
│   │   │   ├── fetch-repos/route.js
│   │   │   └── reject-repo/route.js
│   │   │
│   │   ├── techcrunch/
│   │   │   ├── fetch-articles/route.js
│   │   │   └── reject-article/route.js
│   │   │
│   │   ├── notifications/
│   │   │   └── route.js
│   │   │
│   │   ├── settings/
│   │   │   └── route.js
│   │   │
│   │   ├── statistics/
│   │   │   ├── route.js
│   │   │   └── tweet-stats/route.js
│   │   │
│   │   └── health/
│   │       └── route.js
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.js
│   │   └── layout.js
│   │
│   ├── (dashboard)/
│   │   ├── layout.js (Dashboard wrapper)
│   │   ├── page.js (Dashboard home)
│   │   ├── tweets/
│   │   │   └── page.js
│   │   ├── github/
│   │   │   └── page.js
│   │   ├── techcrunch/
│   │   │   └── page.js
│   │   ├── notifications/
│   │   │   └── page.js
│   │   ├── statistics/
│   │   │   └── page.js
│   │   └── settings/
│   │       └── page.js
│   │
│   └── layout.js (Root layout)
│
├── components/
│   ├── auth/
│   │   ├── auth-wrapper.js
│   │   ├── otp-form.js
│   │   └── login-page.js
│   │
│   ├── dashboard/
│   │   ├── dashboard-layout.js
│   │   ├── sidebar.js
│   │   ├── navbar.js
│   │   ├── quick-actions.js
│   │   └── stats-card.js
│   │
│   ├── tweets/
│   │   ├── tweet-card.js
│   │   ├── tweet-list.js
│   │   ├── tweet-form.js
│   │   └── bulk-actions.js
│   │
│   ├── github/
│   │   ├── repo-card.js
│   │   ├── repo-list.js
│   │   └── repo-filter.js
│   │
│   ├── notifications/
│   │   ├── notification-item.js
│   │   └── notification-list.js
│   │
│   ├── ui/ (shadcn/ui components)
│   │   ├── button.js
│   │   ├── input.js
│   │   ├── card.js
│   │   ├── dialog.js
│   │   ├── toast.js
│   │   └── ... (40+ components)
│   │
│   └── providers/
│       ├── firebase-provider.js
│       ├── auth-provider.js
│       ├── theme-provider.js
│       └── toast-provider.js
│
├── lib/
│   ├── firebase/
│   │   ├── firebase-config.js
│   │   ├── firebase-admin.js
│   │   ├── firestore-service.js
│   │   ├── auth-service.js
│   │   ├── storage-service.js
│   │   └── realtime-service.js
│   │
│   ├── services/
│   │   ├── twitter-client.js
│   │   ├── github-client.js
│   │   ├── news-service.js
│   │   ├── ai-service.js
│   │   ├── notification-service.js
│   │   └── hashtag-generator.js
│   │
│   ├── utils/
│   │   ├── auth-utils.js
│   │   ├── validation.js
│   │   ├── crypto-utils.js
│   │   ├── rate-limiter.js
│   │   ├── error-handler.js
│   │   ├── logger.js
│   │   └── helpers.js
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useFirestore.js
│   │   ├── useTweets.js
│   │   ├── useSettings.js
│   │   └── useNotifications.js
│   │
│   ├── types.js (JSDoc types)
│   └── constants.js
│
├── public/
│   ├── images/
│   └── icons/
│
├── styles/
│   ├── globals.css
│   ├── variables.css
│   └── animations.css
│
├── .env.local (secrets)
├── .env.example (template)
├── .firebase/ (Firebase config)
├── firebase.json (Deployment config)
├── next.config.js
├── tailwind.config.js
├── postcss.config.mjs
├── package.json
├── jsconfig.json (Path aliases)
├── .eslintrc.json
├── .prettierrc
└── README.md
```

---

## 5. FIREBASE SETUP & CONFIGURATION

### 5.1 Firebase Project Creation

```bash
# 1. Create project in Firebase Console
# https://console.firebase.google.com

# 2. Install Firebase CLI
npm install -g firebase-tools

# 3. Login and initialize
firebase login
firebase init

# 4. Select services:
# - Firestore Database
# - Authentication
# - Cloud Storage
# - Cloud Functions (optional)
# - Hosting (optional)
```

### 5.2 Environment Variables

```env
# .env.local
# ============ FIREBASE CONFIG ============
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# ============ FIREBASE ADMIN (Backend) ============
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account-key.json
# OR as JSON string:
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# ============ EXTERNAL API KEYS ============
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_TOKEN_SECRET=your_secret
TWITTER_BEARER_TOKEN=your_bearer

OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GEMINI_API_KEY=your_key

GITHUB_TOKEN=your_token

GMAIL_EMAIL=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# ============ APPLICATION CONFIG ============
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_TIMEOUT=30000
ENCRYPTION_SECRET=your_encryption_key_32_chars
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=3600000
```

### 5.3 Firebase Configuration Files

```javascript
// lib/firebase/firebase-config.js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const firestore = getFirestore(app)
export const storage = getStorage(app)
export const realtimeDb = getDatabase(app) // For engagement stats

export default app
```

```javascript
// lib/firebase/firebase-admin.js
import admin from 'firebase-admin'
import path from 'path'

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require('./firebase-service-account-key.json')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
  })
}

export const adminFirestore = admin.firestore()
export const adminAuth = admin.auth()
export const adminStorage = admin.storage()

export default admin
```

### 5.4 Firebase Deployment Configuration

```json
// firebase.json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": ".next",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## 6. KEY JAVASCRIPT SERVICES

### 6.1 Authentication Service

```javascript
// lib/firebase/auth-service.js

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { auth, firestore } from './firebase-config'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import crypto from 'crypto'
import { sendEmail } from '../services/notification-service'

/**
 * @typedef {Object} AuthUser
 * @property {string} uid
 * @property {string} email
 * @property {boolean} emailVerified
 * @property {Object} metadata
 */

export class AuthService {
  constructor() {
    this.otpStore = new Map()
  }

  /**
   * Send OTP to email
   * @param {string} email - User email
   * @returns {Promise<{sessionId: string, expiresIn: number}>}
   */
  async sendOTP(email) {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const sessionId = crypto.randomBytes(32).toString('hex')

    // Hash OTP
    const otpHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex')

    // Store with 5-minute expiration
    const expiresAt = Date.now() + 5 * 60 * 1000
    this.otpStore.set(sessionId, {
      otpHash,
      email,
      expiresAt,
      attempts: 0
    })

    // Send email
    await sendEmail({
      to: email,
      subject: 'Your Login Code',
      html: `<h1>${otp}</h1><p>Code expires in 5 minutes</p>`
    })

    return { sessionId, expiresIn: 5 * 60 }
  }

  /**
   * Verify OTP
   * @param {string} sessionId
   * @param {string} otp
   * @returns {Promise<{idToken: string, refreshToken: string}>}
   */
  async verifyOTP(sessionId, otp) {
    const session = this.otpStore.get(sessionId)

    if (!session || session.expiresAt < Date.now()) {
      throw new Error('OTP expired or invalid session')
    }

    if (session.attempts >= 3) {
      this.otpStore.delete(sessionId)
      throw new Error('Too many attempts')
    }

    const otpHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex')

    if (otpHash !== session.otpHash) {
      session.attempts++
      throw new Error('Invalid OTP')
    }

    // Create or get user
    const userCredential = await this.getOrCreateUser(session.email)

    this.otpStore.delete(sessionId)

    return {
      idToken: userCredential.user.refreshToken,
      email: session.email
    }
  }

  /**
   * Get or create user account
   * @param {string} email
   * @returns {Promise<UserCredential>}
   */
  async getOrCreateUser(email) {
    try {
      const tempPassword = crypto.randomBytes(32).toString('hex')
      return await createUserWithEmailAndPassword(auth, email, tempPassword)
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        // Sign in existing user (password reset flow needed for real app)
        return await signInWithEmailAndPassword(auth, email, 'temp')
      }
      throw error
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<AuthUser|null>}
   */
  async checkAuth() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(firestore, 'users', user.uid))
          resolve({
            uid: user.uid,
            email: user.email,
            profile: userDoc.data()
          })
        } else {
          resolve(null)
        }
        unsubscribe()
      })
    })
  }

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  async logout() {
    await signOut(auth)
  }

  /**
   * Create user profile in Firestore
   * @param {string} uid
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async createUserProfile(uid, data) {
    await setDoc(doc(firestore, 'users', uid), {
      ...data,
      createdAt: new Date(),
      apiUsage: {
        gemini: 0,
        openai: 0,
        claude: 0
      }
    })
  }
}

export const authService = new AuthService()
```

### 6.2 Firestore Service

```javascript
// lib/firebase/firestore-service.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { firestore } from './firebase-config'
import crypto from 'crypto'

export class FirestoreService {
  /**
   * Create document
   * @param {string} collectionName
   * @param {string} documentId
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async createDoc(collectionName, documentId, data) {
    await setDoc(doc(firestore, collectionName, documentId), {
      ...data,
      createdAt: serverTimestamp()
    })
  }

  /**
   * Get single document
   * @param {string} collectionName
   * @param {string} documentId
   * @returns {Promise<Object|null>}
   */
  async getDoc(collectionName, documentId) {
    const docSnap = await getDoc(doc(firestore, collectionName, documentId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  }

  /**
   * Get all documents with query
   * @param {string} collectionName
   * @param {Array} constraints - where, orderBy, limit conditions
   * @returns {Promise<Array>}
   */
  async getDocs(collectionName, constraints = []) {
    const q = query(collection(firestore, collectionName), ...constraints)
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  /**
   * Real-time listener (for React hooks)
   * @param {string} collectionName
   * @param {Array} constraints
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onSnapshot(collectionName, constraints, callback) {
    const q = query(collection(firestore, collectionName), ...constraints)
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      callback(docs)
    })
  }

  /**
   * Update document
   * @param {string} collectionName
   * @param {string} documentId
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async updateDoc(collectionName, documentId, data) {
    await updateDoc(doc(firestore, collectionName, documentId), {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  /**
   * Delete document
   * @param {string} collectionName
   * @param {string} documentId
   * @returns {Promise<void>}
   */
  async deleteDoc(collectionName, documentId) {
    await deleteDoc(doc(firestore, collectionName, documentId))
  }

  /**
   * Batch write (multiple operations)
   * @param {Array} operations - [{type: 'set'|'update'|'delete', ...}]
   * @returns {Promise<void>}
   */
  async batch(operations) {
    const batch = writeBatch(firestore)

    operations.forEach(op => {
      const docRef = doc(firestore, op.collection, op.id)

      if (op.type === 'set') {
        batch.set(docRef, { ...op.data, createdAt: serverTimestamp() })
      } else if (op.type === 'update') {
        batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() })
      } else if (op.type === 'delete') {
        batch.delete(docRef)
      }
    })

    await batch.commit()
  }

  /**
   * Add to array field
   * @param {string} collectionName
   * @param {string} documentId
   * @param {string} field
   * @param {any} value
   * @returns {Promise<void>}
   */
  async addToArray(collectionName, documentId, field, value) {
    await updateDoc(doc(firestore, collectionName, documentId), {
      [field]: arrayUnion(value)
    })
  }

  /**
   * Remove from array field
   * @param {string} collectionName
   * @param {string} documentId
   * @param {string} field
   * @param {any} value
   * @returns {Promise<void>}
   */
  async removeFromArray(collectionName, documentId, field, value) {
    await updateDoc(doc(firestore, collectionName, documentId), {
      [field]: arrayRemove(value)
    })
  }

  /**
   * Get paginated documents
   * @param {string} collectionName
   * @param {number} pageSize
   * @param {Object} lastDoc
   * @returns {Promise<{docs: Array, lastDoc: Object}>}
   */
  async getPaginated(collectionName, pageSize = 10, lastDoc = null) {
    let q = query(
      collection(firestore, collectionName),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    )

    if (lastDoc) {
      q = query(
        collection(firestore, collectionName),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      )
    }

    const snapshot = await getDocs(q)
    const docs = snapshot.docs.slice(0, pageSize).map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return {
      docs,
      lastDoc: snapshot.docs[pageSize]?.data()
    }
  }
}

export const firestoreService = new FirestoreService()
```

### 6.3 Twitter Service

```javascript
// lib/services/twitter-client.js

import OAuth from 'oauth-1.0a'
import crypto from 'crypto'

export class TwitterClient {
  constructor(config) {
    this.config = config
    this.oauth = new OAuth({
      consumer: {
        key: config.apiKey,
        secret: config.apiSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64')
      }
    })
  }

  /**
   * Post tweet to Twitter
   * @param {Object} params
   * @param {string} params.text - Tweet content (max 280 chars)
   * @param {string} params.replyTo - Optional reply to tweet ID
   * @returns {Promise<{id: string, text: string, created_at: string}>}
   */
  async postTweet({ text, replyTo }) {
    const endpoint = 'https://api.twitter.com/2/tweets'

    const request = {
      url: endpoint,
      method: 'POST',
      data: {
        text,
        ...(replyTo && {
          reply: { in_reply_to_tweet_id: replyTo }
        })
      }
    }

    const authHeader = this.oauth.toHeader(
      this.oauth.authorize(request, {
        key: this.config.accessToken,
        secret: this.config.accessTokenSecret
      })
    )

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader.Authorization
      },
      body: JSON.stringify(request.data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Twitter API Error: ${error.detail}`)
    }

    return response.json()
  }

  /**
   * Get tweet engagement metrics
   * @param {string} tweetId
   * @returns {Promise<{likes: number, retweets: number, replies: number}>}
   */
  async getEngagement(tweetId) {
    const endpoint = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`

    const request = {
      url: endpoint,
      method: 'GET'
    }

    const authHeader = this.oauth.toHeader(
      this.oauth.authorize(request, {
        key: this.config.accessToken,
        secret: this.config.accessTokenSecret
      })
    )

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': authHeader.Authorization
      }
    })

    const data = await response.json()
    const metrics = data.data?.public_metrics || {}

    return {
      likes: metrics.like_count || 0,
      retweets: metrics.retweet_count || 0,
      replies: metrics.reply_count || 0
    }
  }
}
```

### 6.4 AI Service

```javascript
// lib/services/ai-service.js

/**
 * @typedef {Object} AIConfig
 * @property {'gemini'|'openai'|'claude'} provider
 * @property {string} apiKey
 * @property {string} model
 * @property {number} temperature
 * @property {number} maxTokens
 */

export class AIService {
  constructor(config) {
    this.config = config
  }

  /**
   * Generate tweet from content
   * @param {Object} params
   * @param {string} params.content - Source content
   * @param {string} params.context - Additional context
   * @returns {Promise<string>} Generated tweet
   */
  async generateTweet({ content, context }) {
    const prompt = this.buildPrompt(content, context)

    switch (this.config.provider) {
      case 'gemini':
        return this.generateWithGemini(prompt)
      case 'openai':
        return this.generateWithOpenAI(prompt)
      case 'claude':
        return this.generateWithClaude(prompt)
      default:
        throw new Error('Unknown AI provider')
    }
  }

  /**
   * Generate with Google Gemini
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generateWithGemini(prompt) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens
        }
      })
    })

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  }

  /**
   * Generate with OpenAI
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generateWithOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    })

    const data = await response.json()
    return data.choices[0].message.content
  }

  /**
   * Generate with Claude
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generateWithClaude(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    })

    const data = await response.json()
    return data.content[0].text
  }

  /**
   * Build optimized prompt
   * @param {string} content
   * @param {string} context
   * @returns {string}
   */
  buildPrompt(content, context) {
    return `You are an expert social media manager. Create an engaging tweet based on the following content:

Content: ${content}
Context: ${context}

Requirements:
- Maximum 280 characters
- Engaging and professional tone
- Include relevant hashtags
- Make it shareable and valuable to tech audience

Tweet:`
  }
}
```

---

## 7. FIREBASE SECURITY RULES

### 7.1 Firestore Security Rules

```javascript
// firestore.rules

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection - only access own data
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      allow read: if isAdmin();
    }

    // Tweets collection
    match /tweets/{tweetId} {
      allow read: if isAuthenticated();
      allow create, update: if isOwner(resource.data.userId);
      allow delete: if isOwner(resource.data.userId) || isAdmin();

      // Only owner can approve/reject
      match /{document=**} {
        allow update: if isOwner(resource.data.userId) &&
                         request.resource.data.status in ['pending', 'approved', 'rejected'];
      }
    }

    // Articles collection - read all, write by owner
    match /articles/{articleId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // GitHub repos
    match /github_repos/{repoId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Settings - only access own
    match /settings/{userId} {
      allow read, write: if isOwner(userId);
      allow read: if isAdmin();
    }

    // API Keys - encrypted, server-side only
    match /api_keys/{userId} {
      allow read, write: if false; // Always use Admin SDK
    }

    // Notifications - only access own
    match /notifications/{notificationId} {
      allow read, update: if isOwner(resource.data.userId);
      allow create: if isAuthenticated();
    }

    // Audit logs - admin only
    match /audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated(); // System can create
      allow write: if false; // Immutable
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 7.2 Cloud Storage Rules

```javascript
// storage.rules

rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // User avatars
    match /user_avatars/{userId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) && request.resource.size < 5 * 1024 * 1024;
    }

    // Tweet images
    match /tweet_images/{userId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) && request.resource.size < 10 * 1024 * 1024;
    }

    // Temp uploads
    match /temp_uploads/{userId}/{allPaths=**} {
      allow read, write: if isOwner(userId) && request.resource.size < 50 * 1024 * 1024;
    }

    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 8. API ROUTES SPECIFICATIONS

### 8.1 Authentication Routes

#### POST /api/auth/send-otp
```javascript
// app/api/auth/send-otp/route.js

import { NextResponse } from 'next/server'
import { authService } from '@/lib/firebase/auth-service'
import { validateEmail } from '@/lib/utils/validation'
import { rateLimiter } from '@/lib/utils/rate-limiter'

export async function POST(request) {
  try {
    const { email } = await request.json()

    // Validate
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      )
    }

    // Rate limit: 3 per 5 minutes
    const clientIp = request.headers.get('x-forwarded-for')
    await rateLimiter.check(`otp:${clientIp}`, 3, 5 * 60)

    // Send OTP
    const result = await authService.sendOTP(email)

    return NextResponse.json({
      sessionId: result.sessionId,
      expiresIn: result.expiresIn,
      message: 'OTP sent to email'
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

#### POST /api/auth/verify-otp
```javascript
// app/api/auth/verify-otp/route.js

import { NextResponse } from 'next/server'
import { authService } from '@/lib/firebase/auth-service'
import { firestoreService } from '@/lib/firebase/firestore-service'

export async function POST(request) {
  try {
    const { sessionId, otp } = await request.json()

    // Verify OTP
    const { idToken, email } = await authService.verifyOTP(sessionId, otp)

    // Create/update user profile
    await firestoreService.createDoc('users', idToken, {
      email,
      lastLogin: new Date(),
      role: 'user'
    })

    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      email
    })

    response.cookies.set('authToken', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    )
  }
}
```

### 8.2 Tweet Routes

#### GET /api/tweets
```javascript
// app/api/tweets/route.js

import { NextResponse } from 'next/server'
import { firestoreService } from '@/lib/firebase/firestore-service'
import { where, orderBy } from 'firebase/firestore'
import { verifyAuth } from '@/lib/utils/auth-utils'

export async function GET(request) {
  try {
    const user = await verifyAuth(request)
    const { status, limit = 20, cursor } = Object.fromEntries(request.nextUrl.searchParams)

    // Get tweets for user
    const tweets = await firestoreService.getDocs('tweets', [
      where('userId', '==', user.uid),
      ...(status && [where('status', '==', status)]),
      orderBy('createdAt', 'desc')
    ])

    return NextResponse.json({
      tweets,
      total: tweets.length
    })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const user = await verifyAuth(request)
    const data = await request.json()

    const tweetId = crypto.randomUUID()

    await firestoreService.createDoc('tweets', tweetId, {
      ...data,
      userId: user.uid,
      status: 'pending',
      engagement: {
        likes: 0,
        retweets: 0,
        replies: 0
      }
    })

    return NextResponse.json(
      { id: tweetId },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}
```

#### POST /api/tweets/post-now
```javascript
// app/api/tweets/post-now/route.js

import { NextResponse } from 'next/server'
import { firestoreService } from '@/lib/firebase/firestore-service'
import { TwitterClient } from '@/lib/services/twitter-client'
import { verifyAuth } from '@/lib/utils/auth-utils'

export async function POST(request) {
  try {
    const user = await verifyAuth(request)
    const { tweetId } = await request.json()

    // Get tweet
    const tweet = await firestoreService.getDoc('tweets', tweetId)

    if (tweet.userId !== user.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get user settings
    const settings = await firestoreService.getDoc('settings', user.uid)

    // Initialize Twitter client
    const twitter = new TwitterClient({
      apiKey: settings.twitter.apiKey,
      apiSecret: settings.twitter.apiSecret,
      accessToken: settings.twitter.accessToken,
      accessTokenSecret: settings.twitter.accessTokenSecret
    })

    // Post to Twitter
    const result = await twitter.postTweet({
      text: tweet.content
    })

    // Update tweet status
    await firestoreService.updateDoc('tweets', tweetId, {
      status: 'posted',
      postedAt: new Date(),
      twitterId: result.data.id
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

---

## 9. REACT HOOKS & CUSTOM IMPLEMENTATIONS

### 9.1 useAuth Hook

```javascript
// lib/hooks/useAuth.js

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/firebase-config'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      try {
        if (user) {
          setUser({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified
          })
        } else {
          setUser(null)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return { user, loading, error }
}
```

### 9.2 useFirestore Hook (Real-time)

```javascript
// lib/hooks/useFirestore.js

import { useEffect, useState } from 'react'
import { firestoreService } from '@/lib/firebase/firestore-service'

/**
 * @param {string} collection - Firestore collection name
 * @param {Array} constraints - Query constraints (where, orderBy, limit)
 * @returns {Object} { data, loading, error }
 */
export function useFirestore(collection, constraints = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const unsubscribe = firestoreService.onSnapshot(
        collection,
        constraints,
        (docs) => {
          setData(docs)
          setLoading(false)
        }
      )

      return () => unsubscribe()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [collection, JSON.stringify(constraints)])

  return { data, loading, error }
}
```

### 9.3 useTweets Hook

```javascript
// lib/hooks/useTweets.js

import { useCallback, useState } from 'react'
import { useFirestore } from './useFirestore'
import { useAuth } from './useAuth'
import { where, orderBy } from 'firebase/firestore'

export function useTweets(status = null) {
  const { user } = useAuth()
  const [error, setError] = useState(null)

  const constraints = [
    where('userId', '==', user?.uid),
    ...(status && [where('status', '==', status)]),
    orderBy('createdAt', 'desc')
  ]

  const { data: tweets, loading } = useFirestore('tweets', constraints)

  const postTweet = useCallback(async (tweetId) => {
    try {
      const response = await fetch('/api/tweets/post-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId })
      })

      if (!response.ok) throw new Error('Failed to post tweet')
      return await response.json()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const approveTweet = useCallback(async (tweetId) => {
    try {
      const response = await fetch(`/api/tweets/${tweetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      })

      if (!response.ok) throw new Error('Failed to approve tweet')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    tweets,
    loading,
    error,
    postTweet,
    approveTweet
  }
}
```

---

## 10. IMPLEMENTATION ROADMAP

### Phase 1: Project Setup (Week 1)
- [ ] Create Next.js 14 project
- [ ] Install dependencies (Firebase, shadcn/ui, etc.)
- [ ] Setup Firebase project
- [ ] Configure environment variables
- [ ] Setup path aliases (@/lib, @/components)

### Phase 2: Authentication (Week 1-2)
- [ ] Firebase Auth configuration
- [ ] OTP service implementation
- [ ] Auth middleware
- [ ] Login page UI
- [ ] Protected routes wrapper

### Phase 3: Firestore Setup (Week 2)
- [ ] Design and create Firestore collections
- [ ] Setup security rules
- [ ] Create Firestore service layer
- [ ] Test read/write operations

### Phase 4: Core API Routes (Week 2-3)
- [ ] Setup API middleware
- [ ] Implement /api/tweets routes
- [ ] Implement /api/auth routes
- [ ] Implement /api/settings routes
- [ ] Error handling & logging

### Phase 5: Frontend Pages (Week 3-4)
- [ ] Dashboard layout
- [ ] Tweets page
- [ ] Settings page
- [ ] Statistics page
- [ ] Real-time data binding

### Phase 6: External Integrations (Week 4-5)
- [ ] Twitter API integration
- [ ] GitHub API integration
- [ ] NewsAPI integration
- [ ] AI provider integration

### Phase 7: Advanced Features (Week 5-6)
- [ ] Tweet scheduling
- [ ] Automation engine
- [ ] Notifications
- [ ] Bulk operations

### Phase 8: Deployment & Optimization (Week 6-7)
- [ ] Firebase hosting setup
- [ ] Vercel deployment
- [ ] Performance optimization
- [ ] Security audit

---

## 11. FIREBASE vs SUPABASE COMPARISON

| Feature | Firebase | Supabase |
|---------|----------|----------|
| **Database** | Firestore (NoSQL) | PostgreSQL (SQL) |
| **Real-time** | Native listeners | Webhooks/subscriptions |
| **Authentication** | Built-in + OTP | Via Postgres Auth |
| **Storage** | Cloud Storage | AWS S3 bucket |
| **Functions** | Cloud Functions | Edge Functions |
| **Pricing** | Pay-per-use | Fixed + overage |
| **Learning Curve** | Moderate | Lower (SQL) |
| **SQL Queries** | No | Yes |
| **Cold Starts** | ~500ms | ~100ms |
| **Offline Support** | Built-in | Not included |

### Firebase Advantages for This App:
✅ Real-time engagement tracking (likes, retweets)
✅ Built-in authentication (OTP easier)
✅ Automatic data sync across clients
✅ Native file storage integration
✅ Cloud Functions for automation
✅ Better for rapid development

### Data Model Differences:
**Firestore (Document Model):**
```javascript
tweets/{tweetId} = {
  userId, content, status, engagement: {likes, retweets}
}
```

**Supabase (Table Model):**
```sql
CREATE TABLE tweets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  content TEXT,
  status VARCHAR,
  engagement JSONB
)
```

---

## 12. MIGRATION GUIDE (If Converting from Supabase)

### Data Structure Mapping

```javascript
// Supabase JSONB
settings -> notifications -> telegram -> {botToken, chatId}

// Firestore nested document
settings/{userId}/notifications/telegram = {botToken, chatId}

// Supabase array
tweets.tweetIds = [1, 2, 3]

// Firestore array field
articles/{articleId}.tweetIds = [1, 2, 3]
```

### SQL to Firestore Queries

```javascript
// Supabase SQL
SELECT * FROM tweets WHERE user_id = 'X' AND status = 'pending' ORDER BY created_at DESC LIMIT 10;

// Firestore
getDocs(query(
  collection(firestore, 'tweets'),
  where('userId', '==', 'X'),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc'),
  limit(10)
))
```

---

## 13. SECURITY BEST PRACTICES

### Environment Variables
```env
# Keep API keys NEVER in code
# Use .env.local (gitignored)
# Rotate keys every 90 days
```

### Firestore Security
```javascript
// ✓ Good - Server-side only
// lib/firebase/firebase-admin.js
const apiKey = process.env.FIREBASE_ADMIN_KEY

// ✗ Bad - Exposed in client
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_KEY
```

### API Key Encryption
```javascript
// Store encrypted in Firestore
const encrypted = encrypt(apiKey, process.env.ENCRYPTION_SECRET)
await firestoreService.updateDoc('api_keys', userId, {
  twitter: encrypted
})

// Decrypt only when needed
const decrypted = decrypt(encrypted, process.env.ENCRYPTION_SECRET)
```

### Rate Limiting
```javascript
// All public endpoints
await rateLimiter.check(`${userId}:${action}`, maxRequests, timeWindow)
```

### Audit Logging
```javascript
// Every important action
await auditLog.record({
  userId,
  action: 'tweet_posted',
  resource: 'tweets',
  timestamp: new Date(),
  changes: { status: 'approved' -> 'posted' }
})
```

---

## 14. DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Security rules tested
- [ ] Firebase indexes created
- [ ] Rate limiting configured
- [ ] Error handling complete
- [ ] Logging implemented

### Deployment (Vercel)
```bash
# 1. Setup Vercel project
vercel --prod

# 2. Configure environment variables in Vercel dashboard
# 3. Setup automatic deployments from Git
# 4. Configure domain and SSL
```

### Deployment (Firebase Hosting)
```bash
# 1. Build Next.js
npm run build

# 2. Deploy
firebase deploy --only hosting

# 3. Verify
firebase hosting:sites:list
```

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify all integrations working
- [ ] Test user workflows
- [ ] Monitor Firebase quotas

---

## 15. PERFORMANCE OPTIMIZATION

### Firestore Optimization
```javascript
// ✓ Indexed queries (faster)
where('userId', '==', userId),
orderBy('createdAt', 'desc')

// ✗ Non-indexed (slower)
where('status', '==', 'posted'),
where('engagement.likes', '>', 100)

// Solution: Create composite index
```

### Real-time Listener Optimization
```javascript
// ✓ Selective fields
const q = query(
  collection(firestore, 'tweets'),
  where('userId', '==', userId),
  limit(20) // Limit documents
)

// ✗ Load all data
getDocs(collection(firestore, 'tweets')) // Expensive!
```

### Frontend Optimization
```javascript
// ✓ Lazy load images
<Image src={url} loading="lazy" />

// ✓ Code splitting
const TweetsPage = dynamic(() => import('./tweets'), {
  loading: () => <Skeleton />
})

// ✓ Pagination instead of infinite scroll
const [limit, setLimit] = useState(20)
```

---

## 16. TESTING STRATEGY

### Unit Tests
```javascript
// __tests__/auth-service.test.js
import { authService } from '@/lib/firebase/auth-service'

describe('AuthService', () => {
  test('sendOTP generates valid session', async () => {
    const result = await authService.sendOTP('test@example.com')
    expect(result).toHaveProperty('sessionId')
    expect(result).toHaveProperty('expiresIn')
  })

  test('verifyOTP validates correctly', async () => {
    // Mock test
  })
})
```

### Integration Tests
```javascript
// __tests__/api/tweets.test.js
import { NextRequest } from 'next/server'
import { POST as postTweet } from '@/app/api/tweets/route'

describe('POST /api/tweets', () => {
  test('creates new tweet', async () => {
    const request = new NextRequest('http://localhost:3000/api/tweets', {
      method: 'POST',
      body: JSON.stringify({ content: 'Test tweet' })
    })

    const response = await postTweet(request)
    expect(response.status).toBe(201)
  })
})
```

---

## 17. MONITORING & LOGGING

### Firebase Monitoring
```javascript
// View logs in Firebase Console
// https://console.firebase.google.com/project/{projectId}/functions/logs
```

### Custom Logging
```javascript
// lib/utils/logger.js
export const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data)
}
```

### Error Tracking (Optional - Sentry)
```javascript
import * as Sentry from '@sentry/nextjs'

export default Sentry.withServerComponentErrorBoundary(MyComponent, {
  fallback: <ErrorComponent />
})
```

---

## 18. GLOSSARY & REFERENCES

| Term | Definition |
|------|-----------|
| **Firestore** | Google's cloud NoSQL database |
| **Cloud Functions** | Serverless backend functions |
| **Collection** | Like a database table (but flexible) |
| **Document** | Single record (like a row) |
| **Field** | Property of a document |
| **Security Rules** | Access control for data |
| **Listener** | Real-time data subscription |
| **Composite Index** | Multi-field database index |

### Useful Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

## CONCLUSION

Bu PRD, mevcut AI Tweet otomasyon uygulamasını Firebase + Next.js 14 + JavaScript ile nasıl inşa edeceğinizi tam detaylarıyla açıklamıştır.

### Kilit Avantajlar:
✅ **Gerçek-zamanlı Veri Sinkronizasyonu** - Firestore listeners
✅ **Kolay Authentication** - Firebase Auth + OTP
✅ **Serverless Mimarisi** - Cloud Functions
✅ **Ölçeklenebilir** - Otomatik scaling
✅ **İhtiyaca Göre Ödeme** - Kullanıma dayalı fiyatlandırma
✅ **Vercel ile Native Entegrasyon** - Optimal deployment

Bu roadmap takip edilerek 6-7 hafta içinde tam fonksiyonel uygulama geliştirilebilir.

