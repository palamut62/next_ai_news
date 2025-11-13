# Twitter API Keys Management

## Genel Bakış

Bu dokümantasyon, Twitter API key'lerinin nasıl yönetildiğini, saklandığını ve kullanıldığını açıklamaktadır.

## Yapı

### Firebase Koleksiyonu
Twitter API key'leri artık **ayrı ayrı** Firebase'de `twitter_api_keys` koleksiyonunda saklanıyor. Her kayıt 5 key'i içeriyor:

1. **api_key** - Twitter API Key
2. **api_secret** - Twitter API Secret
3. **access_token** - Access Token
4. **access_token_secret** - Access Token Secret
5. **bearer_token** - Bearer Token

### Şifrele
Tüm key'ler Firebase'de saklanmadan önce **AES-256-CBC** ile şifreli halde saklanır.

## Dosya Yapısı

### 1. Backend Services
- **`lib/firebase-api-keys.ts`** - Twitter key'lerini yönetmek için yeni metodlar
  - `saveTwitterApiKey()` - Yeni key ekle/güncelle
  - `getAllTwitterApiKeys()` - Tüm key'leri listele
  - `getActiveTwitterApiKey()` - Aktif key'i getir
  - `getTwitterApiKeyById(id)` - Belirli key'i getir
  - `deleteTwitterApiKey(id)` - Key sil
  - `toggleTwitterApiKeyStatus(id, isActive)` - Aktivite durumunu değiştir
  - `recordTwitterKeyUsage(id)` - Kullanım sayısını artır

- **`lib/twitter-v2-client.ts`** - Tweet posting
  - Firebase'den aktif Twitter key'ini yükle
  - Fallback olarak environment variables'ı kullan
  - Başarılı posting sonrası kullanım sayısını artır

### 2. API Routes
- **`app/api/twitter-keys/route.ts`** - Twitter key'leri yönetmek için API endpoint'leri
  - `GET /api/twitter-keys` - Tüm key'leri listele (şifreli olmayan meta veri)
  - `GET /api/twitter-keys?id=<id>` - Belirli key'i getir (şifresi çözülmüş)
  - `POST /api/twitter-keys` - Yeni key ekle
  - `PUT /api/twitter-keys` - Key'in aktivite durumunu değiştir
  - `DELETE /api/twitter-keys?id=<id>` - Key sil

### 3. UI Pages
- **`app/twitter-api-keys/page.tsx`** - Twitter API Keys yönetim sayfası
  - 5 ayrı key field'ı göster
  - Düzenleme ve silme işlemleri
  - Show/Hide ve Copy to Clipboard özellikleri
  - Kullanım istatistikleri (kaç kez kullanıldığı, son kullanım tarihi)
  - Aktivite durumu yönetimi

### 4. Navigation
- **`components/sidebar.tsx`** - "Twitter Keys" menü öğesi eklendi
  - Main navigation: `/twitter-api-keys`
  - Profile menu: Twitter Keys link

## Workflow

### 1. Key Eklemek
```
Kullanıcı → Web UI (twitter-api-keys page) → POST /api/twitter-keys
→ firebase-api-keys.saveTwitterApiKey() → Firebase (şifreli)
```

### 2. Tweet Gönderme
```
Tweet Post Request → /api/tweets/post-now
→ twitter-v2-client.postTextTweetV2()
→ getActiveTwitterApiKey() [Firebase'den]
→ Decrypt keys → Twitter API
→ recordTwitterKeyUsage() [kullanım sayısını artır]
```

### 3. Key'leri Listelemek
```
Kullanıcı → Twitter Keys Page
→ GET /api/twitter-keys
→ firebase-api-keys.getAllTwitterApiKeys()
→ UI'de meta veri (şifresiz) göster
```

## Firebase Security Rules

Twitter API key'leri Firebase'de saklandığında, aşağıdaki kurallar ile korunmalıdır:

```javascript
match /twitter_api_keys/{document=**} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}
```

## Environment Variables (Fallback)

Eğer Firebase'de aktif key yoksa, aşağıdaki environment variables'dan yükle:

```env
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_TOKEN_SECRET=...
TWITTER_BEARER_TOKEN=...
```

## Usage Statistics

Her Twitter key şunları takip eder:
- **usage_count** - Key kaç kez kullanıldığı
- **last_used** - Son kullanım tarihi
- **created_at** - Oluşturulma tarihi
- **updated_at** - Son güncelleme tarihi
- **is_active** - Aktif/Pasif durumu

## Migration from Old System

Eski sistem tek bir kayıtta 5 key'i JSON olarak saklıyordu:

```json
{
  "api_key": "{\"api_key\": \"...\", \"api_secret\": \"...\", ...}"
}
```

Yeni sistem bunları ayrı ayrı saklar:
```json
{
  "api_key": "...",
  "api_secret": "...",
  "access_token": "...",
  "access_token_secret": "...",
  "bearer_token": "...",
  "key_name": "Main Account",
  "is_active": true
}
```

## Best Practices

1. **Multiple Keys:** Farklı accounts için farklı key'ler oluştur
2. **Naming:** Key'leri anlamlı isimler ile isimlendır (ör. "Main Account", "Backup")
3. **Description:** Key'in ne için kullanıldığını description'da kaydet
4. **Monitoring:** Usage count ve last_used tarihleri ile key aktivitesini izle
5. **Rotation:** Eski key'leri düzenli olarak pasifleştir

## Testing

Yeni Twitter API keys sayfasına git: `/twitter-api-keys`

1. "Add Twitter Key" butonuna tıkla
2. Tüm 5 field'ı doldur
3. Key'i kaydet
4. Listeyi gözlemle
5. Tweet göndermeyi test et (sistem aktif key'i otomatik kullanacak)
