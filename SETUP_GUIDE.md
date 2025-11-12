# Firebase + Next.js AI Tweet App - Setup Kılavuzu

**Tahmini Süre:** 2-3 saat
**Zorluk Seviyesi:** Orta
**Ön Koşullar:** Node.js 18+, npm/yarn, Firebase hesabı, GitHub

---

## ADIM 1: Firebase Projesi Oluşturma

### 1.1 Firebase Console'da Proje Oluşturma

```bash
# 1. https://console.firebase.google.com adresine gidin
# 2. "Proje Oluştur" butonuna tıklayın
# 3. Proje adı girin (örn: "ai-tweet-app")
# 4. Google Analytics'i etkinleştirin (opsiyonel)
# 5. "Proje Oluştur" butonuna tıklayın (2-3 dakika bekleyin)
```

### 1.2 Firebase Servislerini Etkinleştirme

```bash
# Firebase Console > Proje > Build sekmesi:

1. Firestore Database
   ├─ "Firestore Database Oluştur"
   ├─ Üretim modunda başlat (sonra kuralları konfigüre ederiz)
   ├─ Bölge: us-central1 (varsayılan)
   └─ "Oluştur" tıkla

2. Authentication
   ├─ "Kimlik Doğrulamaya Başla"
   ├─ Email/Şifre etkinleştir
   ├─ (Opsiyonel) Google Sign-In etkinleştir
   └─ "Kaydet" tıkla

3. Cloud Storage
   ├─ "Depolama Başlat"
   ├─ Varsayılan bucket adını kabul et
   ├─ Bölge: us-central1
   └─ "Oluştur" tıkla

4. Cloud Functions (Opsiyonel)
   ├─ "Başla" tıkla
   └─ Runtime seçin: Node.js 18
```

### 1.3 Web Uygulamasını Kaydetme

```bash
# Firebase Console > Proje > Genel Ayarlar:

1. Uygulamalar bölümüne gidin
2. "</>" (Web) simgesine tıklayın
3. Uygulama takma adı girin: "ai-tweet-web"
4. "Uygulama Kaydı" tıkla
5. Gösterilen Firebase config'i kopyalayın

# Çıktı şöyle görünür:
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "ai-tweet-app.firebaseapp.com",
  projectId: "ai-tweet-app",
  storageBucket: "ai-tweet-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

---

## ADIM 2: Next.js Projesini Kurma

### 2.1 Yeni Next.js Projesi Oluşturma

```bash
# Terminal'de:
cd ~/projects
npx create-next-app@latest ai-tweet-app

# Sorulara cevapları:
? Would you like to use TypeScript? → No
? Would you like to use ESLint? → Yes
? Would you like to use Tailwind CSS? → Yes
? Would you like your code inside a `src/` directory? → No
? Would you like to use App Router? → Yes
? Would you like to use Turbopack for next dev? → Yes (opsiyonel)
? Would you like to customize the import alias? → Yes
? What import alias would you like configured? → @/*

# Proje klasörüne gidin
cd ai-tweet-app
```

### 2.2 Bağımlılıkları Yükleme

```bash
# Temel Firebase paketleri
npm install firebase firebase-admin

# UI ve Form Yönetimi
npm install react-hook-form zod @hookform/resolvers

# shadcn/ui bileşenleri
npx shadcn-ui@latest init

# Ek paketler
npm install oauth-1.0a sonner date-fns clsx tailwind-merge
npm install recharts lucide-react  # İkonlar ve grafikler

# Geliştirme araçları
npm install -D eslint-config-next @types/node
```

### 2.3 Dizin Yapısını Oluşturma

```bash
# Proje kökünde:

mkdir -p app/api/auth
mkdir -p app/api/tweets
mkdir -p app/api/news
mkdir -p app/api/github
mkdir -p app/api/techcrunch
mkdir -p app/api/notifications
mkdir -p app/api/settings
mkdir -p app/api/statistics
mkdir -p app/(auth)/login
mkdir -p app/(dashboard)/tweets
mkdir -p app/(dashboard)/github
mkdir -p app/(dashboard)/techcrunch
mkdir -p app/(dashboard)/settings
mkdir -p app/(dashboard)/notifications
mkdir -p app/(dashboard)/statistics

mkdir -p components/auth
mkdir -p components/dashboard
mkdir -p components/tweets
mkdir -p components/github
mkdir -p components/ui
mkdir -p components/providers

mkdir -p lib/firebase
mkdir -p lib/services
mkdir -p lib/utils
mkdir -p lib/hooks

mkdir -p styles
mkdir -p public/images
mkdir -p public/icons
```

---

## ADIM 3: Environment Değişkenlerini Konfigüre Etme

### 3.1 .env.local Dosyası Oluşturma

```bash
# Proje kökünde .env.local dosyası oluşturun:
touch .env.local

# Dosyayı açıp aşağıdakileri ekleyin:
```

```env
# ============ FIREBASE CONFIG (From Step 1.3) ============
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-tweet-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-tweet-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-tweet-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# ============ FIREBASE ADMIN (Backend Only) ============
# Firebase Console > Proje Ayarları > Hizmet Hesapları > Node.js
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# ============ TWITTER API ============
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
TWITTER_BEARER_TOKEN=your_bearer_token_here

# ============ AI PROVIDERS ============
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIzaSy...

# ============ GITHUB API ============
GITHUB_TOKEN=ghp_...

# ============ EMAIL (Gmail) ============
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password-here

# ============ TELEGRAM ============
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHAT_ID=123456789

# ============ APP CONFIG ============
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
ENCRYPTION_SECRET=your-32-character-encryption-secret-key
```

### 3.2 .env.example Dosyası Oluşturma (GitHub için)

```bash
# Dosya: .env.example
# Gizli değerleri boş bırakın, yapı göster

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_JSON=

# Twitter API
TWITTER_API_KEY=
TWITTER_API_SECRET=
# ... diğerleri
```

---

## ADIM 4: Firebase Hizmet Hesabını Ayarlama

### 4.1 Hizmet Hesabı Anahtarı İndirme

```bash
# Firebase Console:
# 1. Proje Ayarları (⚙️) > Hizmet Hesapları
# 2. Node.js sekmesini seçin
# 3. "Yeni Özel Anahtar Oluştur" tıkla
# 4. İndirilen firebase-service-account-key.json dosyasını
#    proje kökünün .gitignore'da olacak şekilde kaydedin

# .gitignore'a ekleyin:
echo "firebase-service-account-key.json" >> .gitignore
echo ".env.local" >> .gitignore
```

### 4.2 Service Account JSON'ını Çevre Değişkenine Dönüştürme

```bash
# Linux/macOS:
cat firebase-service-account-key.json | jq -c '.' | xargs -I {} bash -c 'echo "FIREBASE_SERVICE_ACCOUNT_JSON={}"'

# Windows (PowerShell):
Get-Content firebase-service-account-key.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

Çıktıyı kopyalayıp `.env.local`'da `FIREBASE_SERVICE_ACCOUNT_JSON` değişkenine yapıştırın.

---

## ADIM 5: Firebase Yapısını Oluşturma

### 5.1 Firestore Koleksiyonlarını Oluşturma

```bash
# Firebase Console > Firestore Database:

# Koleksiyonları oluşturmak için:
# 1. "+ Koleksiyon Ekle" tıkla
# 2. Adını gir: "users"
# 3. "Belge Ekle" tıkla
# 4. Belge Kimliği: "demo-user"
# 5. Alan ekle:
#    - email: "demo@example.com"
#    - createdAt: server timestamp
#    - role: "user"
# 6. Kaydet

# Aşağıdaki koleksiyonlar için tekrar et:
- users
- tweets
- articles
- github_repos
- settings
- api_keys
- notifications
- audit_logs
```

### 5.2 Firestore Security Rules'ı Konfigüre Etme

```bash
# Firebase Console > Firestore > Rules:

# Aşağıdaki kuralları yapıştırın (PRD_FIREBASE_NEXTJS.md 7. Bölümünden)
# Kuralları kopyalayıp yapıştır > Yayımla
```

### 5.3 Firestore İndekslerini Oluşturma

```bash
# Firebase Console > Firestore > İndeksler:

# Bileşik İndeksleri oluşturun:
# 1. Collection: tweets
#    Fields: userId (Ascending), createdAt (Descending)
#    Scope: Collection

# 2. Collection: tweets
#    Fields: userId (Ascending), status (Ascending), createdAt (Descending)
#    Scope: Collection

# İndeksler otomatik olarak oluşturulacaktır (1-2 dakika)
```

---

## ADIM 6: Temel Kod Dosyalarını Oluşturma

### 6.1 Firebase Config Dosyaları

```bash
# lib/firebase/firebase-config.js oluşturun
# lib/firebase/firebase-admin.js oluşturun
# lib/firebase/firestore-service.js oluşturun
# lib/firebase/auth-service.js oluşturun

# (Tam kod için PRD_FIREBASE_NEXTJS.md 6. Bölümünü görmek)
```

### 6.2 Örnek API Route'u

```bash
# app/api/health/route.js oluşturun:
```

```javascript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}
```

Test edin:
```bash
npm run dev
# http://localhost:3000/api/health ziyaret edin
```

### 6.3 Root Layout Dosyası

```bash
# app/layout.js oluşturun
```

```javascript
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'

export const metadata = {
  title: 'AI Tweet App',
  description: 'Automate tweet generation with AI'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## ADIM 7: İlk Test

### 7.1 Development Server'ı Başlatma

```bash
npm run dev

# Çıktı:
# > ai-tweet-app@0.1.0 dev
# > next dev --turbopack
#
# ▲ Next.js 14.2.0
# - Local:        http://localhost:3000
# - Environments: .env.local
```

### 7.2 Temel Sayfaları Test Etme

```bash
# Tarayıcıda açın:
http://localhost:3000               # Ev sayfası
http://localhost:3000/api/health   # Sağlık kontrolü
```

### 7.3 Firebase Bağlantısını Test Etme

```javascript
// app/page.js içinde:
'use client'

import { useEffect, useState } from 'react'
import { getAuth } from 'firebase/auth'
import app from '@/lib/firebase/firebase-config'

export default function Home() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    try {
      const auth = getAuth(app)
      setConnected(!!auth.app)
    } catch (error) {
      console.error('Firebase connection error:', error)
    }
  }, [])

  return (
    <main>
      <h1>AI Tweet App</h1>
      <p>Firebase: {connected ? '✅ Connected' : '❌ Not connected'}</p>
    </main>
  )
}
```

---

## ADIM 8: Git Repository'sini Başlatma

### 8.1 Git'i Başlatma

```bash
git init
git add .
git commit -m "Initial project setup with Firebase and Next.js"
```

### 8.2 .gitignore Doğrulama

```bash
# Dosya: .gitignore
node_modules/
.next/
.env.local
.env.*.local
firebase-service-account-key.json
.DS_Store
*.log
.firebase/
```

### 8.3 GitHub'a Push Etme

```bash
# GitHub'da yeni repository oluşturun
git branch -M main
git remote add origin https://github.com/yourusername/ai-tweet-app.git
git push -u origin main
```

---

## ADIM 9: Vercel'e Deployment (Opsiyonel Ama Tavsiye Edilir)

### 9.1 Vercel'e Bağlanma

```bash
# Vercel CLI'yi yükleyin
npm i -g vercel

# Proje dizininde:
vercel login
vercel link
```

### 9.2 Environment Değişkenlerini Konfigüre Etme

```bash
# Vercel Dashboard'da:
# 1. Proje > Ayarlar > Environment Variables
# 2. Tüm .env.local değişkenlerini ekleyin
# 3. Production, Preview, Development için ayarlayın
```

### 9.3 Dağıtma

```bash
# Production'a dağıtın
vercel --prod

# Çıktı:
# ✔ Production: https://ai-tweet-app.vercel.app
```

---

## ADIM 10: Automation & Scheduled Tasks (Cloud Functions)

### 10.1 Cloud Functions Kurulumu

```bash
# Firebase CLI'yi yükleyin (zaten varsa skip edin)
npm install -g firebase-tools

# Proje dizininde Cloud Functions'ı başlatın
firebase init functions

# Seçimler:
? What language would you like to use to write Cloud Functions? → JavaScript
? Do you want to use ESLint? → Yes
? File functions/package.json already exists. Overwrite? → No
? File functions/index.js already exists. Overwrite? → Yes
```

### 10.2 Tweet Otomasyonu Fonksiyonu

```javascript
// functions/index.js

const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

// Her saat başında kontrol et
exports.autoPostTweets = functions.pubsub
  .schedule('0 * * * *') // Her saat
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const db = admin.firestore()

    // Yayınlanacak tweetleri bul
    const snapshot = await db.collection('tweets')
      .where('status', '==', 'approved')
      .where('scheduledAt', '<=', admin.firestore.Timestamp.now())
      .get()

    const batch = db.batch()
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: 'posted',
        postedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    })

    await batch.commit()
    console.log(`Posted ${snapshot.size} tweets`)
    return null
  })
```

### 10.3 Engagement Tracking Fonksiyonu

```javascript
// functions/index.js (devam)

exports.trackEngagement = functions.pubsub
  .schedule('every 6 hours') // Her 6 saat
  .onRun(async (context) => {
    const db = admin.firestore()
    const twitter = require('oauth-1.0a')

    // Posted tweetleri bul
    const snapshot = await db.collection('tweets')
      .where('status', '==', 'posted')
      .get()

    snapshot.forEach(async (doc) => {
      const tweet = doc.data()

      // Twitter API'ye çağrı yap
      // Metrikleri güncelle
      await db.collection('tweets').doc(doc.id).update({
        engagement: {
          likes: 150,
          retweets: 30,
          replies: 5
        }
      })
    })

    console.log(`Tracked engagement for ${snapshot.size} tweets`)
    return null
  })
```

### 10.4 Cloud Functions'ı Dağıtma

```bash
firebase deploy --only functions

# Çıktı:
# ✔ functions[autoPostTweets]: deployed successfully
# ✔ functions[trackEngagement]: deployed successfully
```

---

## ADIM 11: Monitoring & Logging

### 11.1 Google Cloud Logging

```bash
# Firebase Console > Functions > Logs
# Tüm Cloud Function yürütmelerini görebilirsiniz
```

### 11.2 Vercel Analytics

```bash
# Vercel Dashboard > Analytics
# Performance ve error tracking
```

### 11.3 Firebase Performance Monitoring

```bash
# Firebase Console > Performance
# Sayfa yükleme sürelerini ve hataları izleyin
```

---

## ADIM 12: Üretim Kontrol Listesi

Dağıtımdan önce:

- [ ] Tüm .env.local değişkenleri Vercel'de ayarlandı
- [ ] Firebase Security Rules yayımlandı
- [ ] Firestore İndeksleri oluşturdu
- [ ] API Keys şifrelenmiş (ENCRYPTION_SECRET ayarlandı)
- [ ] Rate limiting yapılandırıldı
- [ ] CORS kuralları ayarlandı
- [ ] Audit logging aktif
- [ ] Error handling tüm route'larda
- [ ] Tests geçti (npm run test)
- [ ] Production build başarılı (npm run build)

---

## Sorun Giderme

### Firebase Connection Error

```javascript
// Problem: "firebase is not defined"
// Çözüm: firebase-config.js doğru import ediliyor mu kontrol edin

import app from '@/lib/firebase/firebase-config'
import { getFirestore } from 'firebase/firestore'
const db = getFirestore(app) // ✓ Doğru
```

### OTP Email Gönderilmiyor

```bash
# Gmail:
# 1. 2FA'yı etkinleştir
# 2. App Password oluştur (16 karakter)
# 3. .env.local'da GMAIL_APP_PASSWORD olarak kullan
```

### Firestore Izinleri Reddedildi

```javascript
// Sorun: "Permission denied" hatası
// Çözüm: Security Rules'u kontrol et
// Firebase Console > Firestore > Rules > Yayımla
```

### Vercel Build Hatası

```bash
# Build log'larını kontrol edin:
vercel logs

# ESLint hatası varsa:
npm run lint -- --fix
```

---

## Sonraki Adımlar

1. **Authentication Sayfasını Tasarla**
   - lib/hooks/useAuth.js oluştur
   - components/auth/login-page.js oluştur

2. **Dashboard'u Oluştur**
   - Sidebar navigasyon
   - Stats cards
   - Quick actions

3. **Tweet API'sini Uygula**
   - POST /api/tweets
   - GET /api/tweets
   - PATCH /api/tweets/[id]

4. **External API'lerini Entegre Et**
   - Twitter Client
   - GitHub Client
   - NewsAPI Client

5. **Advanced Features**
   - Tweet scheduling
   - Bulk operations
   - Notifications

---

## Kaynaklar

- [Firebase Docs](https://firebase.google.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [shadcn/ui Components](https://ui.shadcn.com)

---

**Tamamladığınızda, aşağıdaki kodu çalıştırarak işaretleyin:**

```bash
npm run build && npm run dev
# Başarılı oldu! 🎉
```

