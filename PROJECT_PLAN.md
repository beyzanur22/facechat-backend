# FaceChat — Master Proje Planı

> ftf.live/tr klonu. Ringtone projesinden tamamen bağımsız.
> Bu dosya projenin tek referans planıdır. İlerledikçe güncellenir.

---

## 1. Vizyon & Model
- **Ürün:** Anonim, rastgele 1-1 WebRTC görüntülü sohbet (ftf.live modeli).
- **Giriş modeli:** KARMA — varsayılan misafir (anonim `deviceId`), isteğe bağlı Google girişi (premium/geçmiş için).
- **Ölçek hedefi:** 5-6k+ eşzamanlı kullanıcı, yüksek giriş-çıkış (churn), profesyonel seviye.
- **Platformlar:** Android (sen) + Web (arkadaş) → **ORTAK backend**. Arkadaş backend'in tüketicisi; sözleşme = `API_CONTRACT.md`.

## 2. Teknoloji Kararları (kesin)
| Katman | Teknoloji | Neden |
|---|---|---|
| Sinyalizasyon | Node.js + Socket.io | WebRTC signaling + gerçek zamanlı |
| Kalıcı DB | **PostgreSQL** | İlişkisel veri, ACID, agregasyon, tekillik |
| Hızlı katman | **Redis** | Eşleştirme kuyruğu + Socket.io adapter + ban cache + presence |
| Medya relay | TURN (coturn) | NAT arkasındaki cihazların bağlanması |
| DB erişimi | Knex | DB-bağımsız query builder + migration |
| Android | Kotlin + stream-webrtc + socket.io-client | native performans |
| Web | Tarayıcı WebRTC + socket.io-client | (arkadaş) |

## 3. Neden PostgreSQL (MongoDB değil)
Veri ilişkisel (users↔bans↔reports↔blocks). Ban/premium tutarlılık (ACID) ister. Moderasyon agregasyon sorgusu ister. Hız gerektiren kısım (kuyruk/presence) zaten **Redis**'te — bu yüzden MongoDB'nin "hızlı yazma" argümanı geçersiz. Sonuç: **Postgres (kalıcı) + Redis (hızlı)** = bu tip uygulamanın standart stack'i.

## 4. Hedef Mimari (5-6k eşzamanlı)
```
İstemciler (Android + Web)
        ↓  (WebSocket)
Load Balancer
        ↓
Stateless Sinyal Sunucuları  (Node 1..N — çoğaltılabilir)
        ↓
Redis  (ortak kuyruk + Socket.io adapter + ban cache + presence)
        ↓
PostgreSQL  (users · bans · reports · blocks · premium)

TURN cluster  ⇠⇢  İstemciler   (P2P medya — SUNUCUDAN GEÇMEZ, bant-genişliği ağır)
```
Kritik: video medyası sunuculardan geçmez → sunucu yükü hafif, asıl maliyet TURN bant genişliği.

## 5. Veritabanı Şeması (karma model)
```
users
  id UUID PK · device_id TEXT UNIQUE NOT NULL (anonim omurga)
  google_id TEXT UNIQUE NULL · email TEXT NULL · display_name TEXT NULL
  gender TEXT · region TEXT
  is_premium BOOL DEFAULT false · premium_until TIMESTAMPTZ NULL
  created_at / last_seen_at TIMESTAMPTZ
bans     device_id · ip_hash · reason · report_count · banned_at · expires_at
reports  reporter_device_id · reported_device_id · session_id · reason · created_at
blocks   blocker_device_id · blocked_device_id · created_at  (UNIQUE çift)
premium_subscriptions (Faz 3)  user_id · platform · product_id · status · expires_at
```
İlke: tablolar **migration (kod)** ile oluşturulur (GUI'den elle değil) → tekrarlanabilir, iki istemci aynı şema. Veri ise Supabase/Neon panelinden görsel izlenir/yönetilir.

## 6. Fazlar & Görevler

### Faz 0 — Analiz & Ortak Zemin ✅ BİTTİ
- [x] Kapsamlı denetim raporu
- [x] API sözleşmesi (`API_CONTRACT.md`)
- [x] Backend sahiplik modeli (sen sahip, arkadaş tüketici)

### Faz 1 — Backend Sağlamlaştırma 🔄 SÜRÜYOR (ortak backend)
- [x] Kod: better-sqlite3 → pg, knexfile/config/db Postgres'e çevrildi, timestamptz
- [x] **Postgres kurulumu + migration** — Supabase (Frankfurt, session pooler), 4 tablo oluştu ✅
- [x] `users` tablosu karma modele göre yazıldı (device_id + google_id + email + premium) ✅
- [x] **Redis**: kuyruk + odalar Redis'e taşındı, Socket.io adapter, atomik eşleştirme kilidi — uçtan uca test GEÇTİ ✅ (Upstash Frankfurt)
- [x] Ban cache — cache-aside + write-through invalidation, test geçti ✅
- [x] **Giriş/kayıt backend'i** — userService (misafir/link/premium+cache), `/api/auth/sync` + `/api/auth/status`, Supabase token doğrulama ✅
  - [ ] SUPABASE_ANON_KEY (.env) + Supabase'de Google provider'ı aç (gerçek login için)
  - [ ] Login UI + Supabase SDK → Faz 2 (Android/Web)
- [x] **TURN** — Metered (free 0.5GB), STUN+TURN `ice-config` + match-found'da sunuluyor ✅ (nazik fallback: TURN yoksa STUN)
- [ ] Session-token auth (report/block IDOR açığını kapat)
- [ ] Rate-limit (socket) + CORS whitelist + input validation + monitoring

> **➡️ VERİ TEMELİ (database kısmı) TAMAMLANDI:** Postgres (kalıcı) + Redis (kuyruk/oda/cache) + ban cache + auth backend. Backend yatay ölçeklenebilir. Kalan işler: TURN (bağlantı), session-token (güvenlik), Faz 2 (istemci).

### Faz 2 — İstemci İşleri (paralel: sen Android, arkadaş Web)
- [ ] Android: Report/Block UI, güvenlik (R8/cert pinning/EncryptedPrefs), MVVM refactor, ForegroundService
- [ ] Web: aynı özellikler (aynı API), TURN'ü ice-config'den alma
- [ ] Ülke/bölge filtresi UI (backend zaten destekliyor)

### Faz 3 — Gelir & Yayın
- [ ] Premium (Google Play Billing + web ödeme)
- [ ] Admin moderasyon paneli (banları/şikayetleri yönet)
- [ ] Testler (unit + entegrasyon + espresso)
- [ ] Store politika hazırlığı (18+ yaş kapısı, KVKK/gizlilik, moderasyon dokümanı)

## 7. Şu An Neredeyiz + Sıradaki Adım
**Konum:** Faz 1 · Postgres migration. Kod hazır. Tek eksik: gerçek `DATABASE_URL`.
**Sıradaki 3 adım:**
1. Supabase/Neon'da Postgres oluştur → `DATABASE_URL`'i `.env`'e koy.
2. `users` migration'ını karma modele göre yaz → `npm run migrate` (tabloları SEN oluştur).
3. Redis'e geç (kuyruk + adapter + cache).

## 8. Maliyet Gerçeği (5-6k ölçek)
Managed Postgres + managed Redis + 2-4 sunucu + **TURN bant genişliği** → ölçekte aylık birkaç yüz–bin USD bandında, çoğu TURN. MVP'de düşük; kullanım arttıkça büyür. Erken optimizasyon yapma: önce güvenli çalışan sistem, sonra ölçek altyapısı.
