# FaceChat — Detaylı Faz Planı (Yürütme Yol Haritası)

> Bu dosya, derin kod analizindeki **her bulguyu** fazlara böler. Her madde analiz koduna (G#=güvenlik, C#=correctness) bağlıdır.
> Durum: `[x]` bitti · `[ ]` yapılacak · `[~]` kısmen. Üst düzey karar/mimari için: `PROJECT_PLAN.md`.
> Paralellik: Faz 6-8 (Android) ile Faz 9 (Web) aynı anda yürüyebilir. Faz 4-5 arka planda serpiştirilebilir.

---

## FAZ 0 — Analiz & Ortak Zemin ✅ TAMAMLANDI
- [x] Kapsamlı denetim + derin kod analizi
- [x] API sözleşmesi (`API_CONTRACT.md`)
- [x] Backend sahiplik modeli (sen sahip, arkadaş tüketici)
- [x] Teknoloji kararları: Postgres + Redis + TURN + Node/Socket.io + Kotlin/Web

## FAZ 1 — Backend Veri & Altyapı Temeli ✅ TAMAMLANDI
- [x] SQLite → **Postgres** (Supabase, Frankfurt, session pooler)
- [x] `users` karma şema (device_id + google_id + email + is_premium + premium_until)
- [x] **Redis** (Upstash): kuyruk (`queue.js`) + odalar (`room.js`) + atomik kilit (`lock.js`/`matchmaker.js`)
- [x] Socket.io Redis adapter (`server.js`) → yatay ölçek
- [x] **Ban cache** (cache-aside + write-through)
- [x] **Auth backend**: `userService` (misafir/link/premium+cache), `/api/auth/sync` + `/status`, Supabase token doğrulama
- [x] **TURN** (Metered): STUN+TURN `ice-config` + match-found'da sunuluyor
- [x] Uçtan uca testler (eşleşme, sinyal relay, ban cache, userService)

---

## FAZ 2 — Backend Güvenlik Sertleştirme ✅ TAMAMLANDI (kod tarafı)
> Hepsi test edildi. G5'in tek eksiği: web domain gelince `CORS_ORIGINS` doldurmak.
- [x] **G2 — `app.set('trust proxy', 1)`** + socket.io `x-forwarded-for` (`utils/ip.js`) ✅
- [x] **G4 — Tek tutarlı tuzlu IP-hash** (`utils/ip.js`, REST + socket aynı fonksiyon) ✅
- [x] **G1 — Session-token** (`reportTokenService`): eşleşmede reportToken üret (Redis), report/block'ta doğrula → IDOR kapandı, test geçti ✅
- [x] **G1b — REST `/api/report` & `/api/block`** artık reportToken doğruluyor (body deviceId kabul etmiyor) ✅
- [x] **C1 — Graceful shutdown** (SIGTERM/SIGINT → soket + Redis + PG temiz kapanış) ✅
- [x] **C2 — `unhandledRejection` / `uncaughtException`** handler'ları ✅
- [x] **C3 — Readiness** (`/ready` DB+Redis ping) ✅
- [x] **G3 — Socket event rate-limit** (per-socket sabit-pencere, `signaling/rateLimit.js`) — 40 istekte 10 blok, test geçti ✅
- [x] **G8 — Input validation** (zod, `validation/schemas.js`): join-queue enum/uzunluk + reason whitelist ✅
- [x] **G5 — CORS** env-ayarlı (`CORS_ORIGINS`); boşsa dev'de açık, web domain gelince kilitlenir ✅

## FAZ 3 — Moderasyon & Kötüye Kullanım Önleme 🔴 (store için zorunlu)
- [ ] **G6 — Aktif moderasyon**: `MODERATION_PROVIDER` gerçek sağlayıcı (Sightengine/Rekognition) + Android on-device ML Kit (şüphede `moderation-flag` çağır)
- [ ] **G6b — moderation-flag sertleştir**: auth + ayrı sıkı rate-limit + boyut sınırı
- [x] Report/block server-side kanıtı (Faz 2 reportToken ile) ✅
- [x] **Admin moderasyon API + görsel panel** (`/admin`): stats, ban/şikayet listesi, en-çok-raporlananlar, elle ban/unban + cache invalidation, token-korumalı (fail-closed) — test geçti ✅
- [ ] **CSAM/güvenlik**: şüpheli içerik tespit + raporlama akışı, otomatik disconnect
- [ ] **Abuse/velocity limitleri**: cihaz başına join/skip hız sınırı, tekrarlanan report tespiti
- [ ] **Play Integrity / device attestation** hazırlığı (backend doğrulama ucu)

## FAZ 4 — Gözlemlenebilirlik, Dayanıklılık & Kalite
- [ ] **Yapılandırılmış log** (pino) + correlation/request ID + env log seviyesi (`logger.js` yerine)
- [ ] **Sentry** (hata takibi) — backend + Android
- [ ] **Metrikler** (`/metrics` Prometheus: eşleşme süresi, kuyruk boyutu, aktif oturum, cache hit)
- [ ] **Merkezi Express error handler** (route try/catch tekrarını azalt)
- [ ] **Resilience**: Supabase/Redis çağrılarında retry/backoff; **Redis düşerse alarm + degrade**
- [ ] **C4 — Bayat-aday canlılık kontrolü**: eşleşmeden önce candidate soketi hâlâ bağlı mı doğrula
- [ ] **Testler**: unit (matcher/cache/services), entegrasyon (auth/report akışı), **contract testi** (API_CONTRACT'a karşı)
- [ ] **CI/CD** (GitHub Actions: lint + test + deploy), **.eslintrc + prettier** commit
- [ ] **Dockerfile** (bu repo için) + tekrarlanabilir deploy
- [ ] **API versioning** (`/api/v1`) + **OpenAPI/Swagger**

## FAZ 5 — KVKK/GDPR & Veri Yaşam Döngüsü ⚖️
- [ ] **Gizlilik Politikası + Aydınlatma Metni** (email PII tutuluyor artık — gerçek beyanlarla)
- [ ] **"Verimi sil" endpoint'i** (`DELETE /api/user`) + hesap silme
- [ ] **Veri retention/TTL**: bans/reports/ipHash süresiz durmasın (örn. 90 gün sonra anonimleştir)
- [ ] **Consent** akışı (istemcide onay)

---

## FAZ 6 — Android: Mimari Refactor 🔴
> `MainActivity.kt` (757 satır) parçalanmalı.
- [ ] **MVVM**: ViewModel'ler (Match/Call state, Chat, Profile)
- [ ] **Repository** katmanı (Signaling, WebRTC, User/Prefs)
- [ ] **UseCase**'ler (JoinQueue, Skip, Report, Block, Login)
- [ ] **DI (Hilt)** — WebRtcClient/SignalingClient/Repository enjekte
- [ ] **ForegroundService** — görüşme sırasında kamera/mik yaşasın + kalıcı bildirim (Android 14 FGS tipi)
- [ ] **Process-death güvenliği** (SavedStateHandle / kalıcı state)
- [ ] **Build variants** (dev/staging/prod) — `Constants.SIGNALING_URL` hardcode kaldır

## FAZ 7 — Android: Özellikler
- [ ] 🔴 **Report/Block UI** — peer kartına/ekrana buton; `signalingClient.report()` + `block` event bağla (backend hazır, UI yok)
- [ ] **Mikrofon mute** butonu (şu an sadece kamera toggle)
- [ ] **Ülke/bölge filtresi UI** (`region`/`filterRegion` hardcode kaldır)
- [ ] **Google login ekranı** — supabase-kt → token al → `/api/auth/sync` çağır
- [ ] **Premium ekranı/rozeti** (is_premium okuma — `/api/auth/status`)
- [ ] **Yaş kapısı (18+)** — ilk açılışta onay
- [ ] **Adaptif video** — sabit 1280x720@30 yerine ağ/cihaza göre çözünürlük/bitrate

## FAZ 8 — Android: Güvenlik & Kalite 🔴
- [ ] **G7 — `usesCleartextTraffic=false`** + Network Security Config + **Certificate Pinning**
- [ ] **G7 — R8/ProGuard aç** (`isMinifyEnabled=true`) + obfuscation kuralları
- [ ] **G7 — EncryptedSharedPreferences** (deviceId)
- [ ] **G7 — Gerçek paket adı** (`com.example.facechat` → gerçek) + release imzalama
- [ ] **G7 — Root/emulator/tamper + Play Integrity** entegrasyonu
- [ ] **Crashlytics + Analytics** (prod crash görünürlüğü)
- [ ] **FCM push** (bildirim altyapısı)
- [ ] **Localization** (policy metinleri `MainActivity`'den strings.xml'e), **Accessibility** (contentDescription/TalkBack)
- [ ] **Testler** (unit + espresso)

## FAZ 9 — Web İstemci (arkadaş, PARALEL)
- [ ] Aynı özellikler: eşleşme, chat, report/block UI, filtreler
- [ ] **Google login** (supabase-js) → `/api/auth/sync`
- [ ] **TURN'ü `ice-config`'den al** (hardcode etme)
- [ ] **CORS**: web domain'i backend whitelist'ine ekle (Faz 2-G5 ile)

---

## FAZ 10 — Gelir (Monetization)
- [ ] **`premium_subscriptions` tablosu** (user_id, platform, product_id, status, expires_at)
- [ ] **Google Play Billing** (Android) + **web ödeme** (Stripe/iyzico)
- [ ] Satın alma doğrulama → `users.is_premium/premium_until` güncelle + cache invalidate
- [ ] **Reklam** (free tier — AdMob) + premium'da reklamsız

## FAZ 11 — Ölçek (5-6k+ eşzamanlı)
- [ ] **C5 — Filtre-kovalı kuyruklar**: gender×region başına ayrı ZSET → global kilit darboğazını kaldır
- [ ] **C6 — Backpressure**: kuyruk/oda üst sınırı + izleme
- [ ] **coturn cluster** (kendi TURN) + **TURN ephemeral/HMAC credential** (statik `.env` yerine)
- [ ] **Bağlantı bütçesi**: Redis/PG pooler connection limitleri, multi-instance ayarı
- [ ] **Multi-instance yük testi** (bots) + kilit çekişmesi senaryosu

## FAZ 12 — Store Yayını
- [ ] Son uyumluluk checklist'i (moderasyon + report/block + yaş + KVKK + Integrity + obfuscation + imza)
- [ ] Store listeleri (açıklama, ekran görüntüleri, içerik derecelendirme)
- [ ] İnceleme hazırlığı (moderasyon dokümantasyonu — random-video-chat kategorisi sıkı)
- [ ] Yayın + izleme

---

### Bağımlılık özeti
- **Faz 2 → her şeyin önünde** (güvenlik + web CORS bağımlı).
- **Faz 3** store için Faz 12'nin ön koşulu.
- **Faz 6-8 (Android)** ↔ **Faz 9 (Web)** paralel, ikisi de Faz 2'nin dondurduğu API'ye dayanır.
- **Faz 4-5** sürekli arka planda ilerler.
- **Faz 10-11** lansmandan hemen önce/sonra.
