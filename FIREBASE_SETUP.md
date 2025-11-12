# Firebase Kurulum Kılavuzu

Bu kılavuz, uygulamanızı Firebase'e geçirmek için gerekli adımları açıklar.

## 1. Firebase Koleksiyonları Oluşturma

Firebase Console'da şu koleksiyonları oluşturun:

### a) `tweets` Koleksiyonu
İçerisinde tweet verilerini saklayan koleksiyon.

**Belge Yapısı:**
```json
{
  "id": "string",
  "content": "string",
  "source": "string (techcrunch|github|news|manual)",
  "source_url": "string",
  "source_title": "string",
  "ai_score": "number (1-10)",
  "status": "string (pending|approved|rejected|posted)",
  "created_at": "timestamp",
  "posted_at": "timestamp (optional)",
  "twitter_id": "string (optional)",
  "engagement": {
    "likes": "number",
    "retweets": "number",
    "replies": "number"
  },
  "post_error": "string (optional)",
  "rejected_at": "timestamp (optional)",
  "hash": "string (duplicate detection için)"
}
```

### b) `rejected_articles` Koleksiyonu
Reddedilen ya da işlenmiş makaleleri saklayan koleksiyon.

**Belge Yapısı:**
```json
{
  "id": "string",
  "title": "string",
  "url": "string",
  "source": "string (techcrunch|news|etc)",
  "published_at": "timestamp",
  "description": "string (optional)",
  "rejected_at": "timestamp",
  "reason": "string (optional - tweet_generated|user_rejected)",
  "hash": "string"
}
```

### c) `rejected_github_repos` Koleksiyonu
Reddedilen ya da işlenmiş GitHub depolarını saklayan koleksiyon.

**Belge Yapısı:**
```json
{
  "id": "string",
  "name": "string",
  "url": "string",
  "full_name": "string",
  "description": "string (optional)",
  "language": "string (optional)",
  "stars": "number",
  "rejected_at": "timestamp",
  "reason": "string (optional - tweet_generated|user_rejected)",
  "hash": "string"
}
```

### d) `api_keys` Koleksiyonu
API anahtarlarını güvenli şekilde saklayan koleksiyon.

**Belge Yapısı:**
```json
{
  "service": "string (gemini|openai|twitter|github|etc)",
  "key_name": "string",
  "api_key": "string (şifreli olmalı)",
  "is_active": "boolean",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "last_used": "timestamp (optional)",
  "usage_count": "number",
  "description": "string (optional)"
}
```

### e) `settings` Koleksiyonu
Uygulama ayarlarını saklayan koleksiyon.

**Belge Yapısı:**
```json
{
  "id": "default",
  "automation": {
    "enabled": "boolean",
    "checkInterval": "number",
    "maxArticlesPerCheck": "number",
    "minAiScore": "number",
    "autoPost": "boolean",
    "requireApproval": "boolean",
    "rateLimitDelay": "number"
  },
  "github": {
    "enabled": "boolean",
    "languages": "array<string>",
    "timeRange": "string",
    "maxRepos": "number",
    "minStars": "number"
  },
  "notifications": {
    "telegram": {
      "enabled": "boolean",
      "botToken": "string",
      "chatId": "string"
    },
    "email": {
      "enabled": "boolean",
      "smtpHost": "string",
      "smtpPort": "number",
      "username": "string",
      "password": "string",
      "fromEmail": "string",
      "toEmail": "string"
    }
  },
  "twitter": {
    "apiKey": "string",
    "apiSecret": "string",
    "accessToken": "string",
    "accessTokenSecret": "string"
  },
  "ai": {
    "provider": "string",
    "apiKey": "string",
    "model": "string",
    "temperature": "number",
    "maxTokens": "number"
  },
  "apiUrl": "string",
  "updated_at": "timestamp"
}
```

## 2. Firestore Kuralları (Security Rules)

Firebase Console'da aşağıdaki security rules'ı ayarlayın:

```firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tüm koleksiyonlar için: sadece authenticated kullanıcılar erişebilir
    match /{document=**} {
      allow read, write: if request.auth != null;
    }

    // API Keys: daha sıkı kontrol
    match /api_keys/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.owner_id;
    }

    // Settings: tüm authenticated kullanıcılar okuyabilir, sadece admin yazabilir
    match /settings/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.customClaims.admin == true;
    }
  }
}
```

## 3. Google Authentication Ayarlaması

### Firebase Console'da:
1. "Authentication" > "Sign-in method" seçeneğine gidin
2. "Google" seçeneğini etkinleştirin
3. Proje destek e-postasını ayarlayın

### `.env.local` dosyasında:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 4. Gemini API Key Ayarlaması

1. [Google AI Studio](https://aistudio.google.com/app/apikey) adresine gidin
2. "Create API Key" tıklayın
3. API key'i kopyalayın
4. `.env.local` dosyasında ayarlayın:
```env
GEMINI_API_KEY=your_gemini_api_key
```

## 5. Verilerin Uygulamada Kullanılması

### Tweet Kaydetme:
```typescript
import { firebaseStorage } from '@/lib/firebase-storage'

const success = await firebaseStorage.saveTweet({
  id: 'tweet-id',
  content: 'Tweet içeriği',
  source: 'techcrunch',
  sourceUrl: 'https://techcrunch.com/...',
  sourceTitle: 'Başlık',
  aiScore: 8.5,
  status: 'pending',
  createdAt: new Date().toISOString(),
  engagement: { likes: 0, retweets: 0, replies: 0 }
})
```

### Tweet Statüsünü Güncelleme:
```typescript
await firebaseStorage.updateTweetStatus('tweet-id', 'approved', {
  twitter_id: 'twitter-post-id'
})
```

### Tüm Tweetleri Getirme:
```typescript
const tweets = await firebaseStorage.getAllTweets()
```

### API Key Kaydetme:
```typescript
import { firebaseApiKeysManager } from '@/lib/firebase-api-keys'

const apiKey = await firebaseApiKeysManager.saveApiKey({
  service: 'gemini',
  key_name: 'Gemini API',
  api_key: 'your-key-here',
  is_active: true,
  description: 'Google Gemini API'
})
```

## 6. Sıkça Sorulan Sorular

### S: Verileri Supabase'den Firebase'e nasıl geçiririm?
C: Aşağıdaki adımları izleyin:
1. Supabase'den JSON olarak tüm verileri export edin
2. Bir migration script yazın
3. Firebase koleksiyonlarına veri yükleyin

### S: API key'leri Firebase'de nasıl güvenli tutarım?
C:
- Firestore Security Rules ile erişimi sınırlandırın
- Sensitive verileri şifreleyin
- Admin panel aracılığıyla sadece değişkenler olarak tutun

### S: Google Sign-in kullanıcıları nasıl yönetir?
C:
```typescript
import { signInWithGoogle } from '@/lib/firebase-auth'

const user = await signInWithGoogle()
// user.uid: Benzersiz kullanıcı kimliği
// user.email: E-posta adresi
// user.displayName: Görünen ad
```

## 7. Sorun Giderme

### "AI service unavailable" hatası:
- GEMINI_API_KEY'in `.env.local` dosyasında olduğunu kontrol edin
- API key'in geçerli olduğundan emin olun
- Google AI Studio'dan yeni bir key oluşturmayı deneyin

### Firestore yazma başarısız:
- Security Rules'ı kontrol edin
- Kullanıcının authenticated olduğunu doğrulayın
- Koleksiyon adlarının doğru olduğundan emin olun

### Firebase bağlantı hatası:
- Firebase config'in `.env.local` dosyasında doğru olduğunu kontrol edin
- Projenin aktif olduğunu doğrulayın
- npm paketi güncellemelerini çalıştırın: `npm install firebase`

---

**Not:** Üretim ortamında kesinlikle sensitive bilgileri `.env.local` dosyasında saklamayın. Bunun yerine Firebase Secret Manager veya Vercel Environment Variables kullanın.
