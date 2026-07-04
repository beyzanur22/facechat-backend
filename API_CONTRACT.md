# FaceChat Backend — API Sözleşmesi (Ortak Kaynak / Single Source of Truth)

> Bu backend **iki istemci tarafından ortak** kullanılır: Android (native Kotlin) ve Web (arkadaş).
> Bu dosya **tek doğru kaynaktır.** Backend protokolü değişecekse ÖNCE bu dosya güncellenir,
> iki taraf haberdar edilir, versiyon artırılır. Aksi halde bir istemci bozulur.
>
> **Protokol sürümü:** v1 (henüz auth yok — Faz 1'de `sessionToken` eklenecek, aşağıda "PLANLANAN" olarak işaretli)

---

## 0. Temel Model

- **Anonim.** Hesap/kayıt YOK. Kimlik = istemcinin ürettiği kalıcı `deviceId` (UUID).
  - Android: `SharedPreferences`'ta saklanır. Web: `localStorage`'ta saklanmalı (aynı mantık).
- **Rastgele 1-1 WebRTC görüntülü sohbet.** Backend yalnızca **sinyalizasyon + eşleştirme + moderasyon**.
  Medya (video/ses/chat) P2P'dir, backend'den GEÇMEZ.
- **Taşıma:** Sinyalizasyon = Socket.io (WebSocket). Yardımcı işlemler = REST.

---

## 1. Socket.io Sinyalizasyon Protokolü

Bağlantı: `io(SIGNALING_URL, { transports: ['websocket'] })`

### İstemci → Sunucu (emit)

| Event | Payload | Açıklama |
|---|---|---|
| `join-queue` | `{ deviceId, nickname, gender, region, filterGender, filterRegion }` | Kuyruğa katıl. `gender`: `"male"\|"female"`. `filterGender`: `"male"\|"female"\|"any"`. `region`/`filterRegion`: ülke kodu veya `"any"`. |
| `offer` | `{ sessionId, sdp: { type, sdp } }` | Sadece `isOfferer=true` olan taraf gönderir. |
| `answer` | `{ sessionId, sdp: { type, sdp } }` | Offer'a cevap. |
| `ice-candidate` | `{ sessionId, candidate: { sdpMid, sdpMLineIndex, candidate } }` | ICE adayı relay. |
| `skip` | `{ sessionId }` | Sıradaki kişiye geç. |
| `leave` | `{ sessionId }` | Görüşmeden/kuyruktan çık. |
| `block` | `{ sessionId }` | Karşı tarafı engelle (bir daha eşleşme yok). |
| `report` | `{ sessionId, reason }` | Karşı tarafı şikayet et. |

### Sunucu → İstemci (on)

| Event | Payload | Açıklama |
|---|---|---|
| `waiting` | `{}` | Uygun eş yok, kuyruktasın. |
| `match-found` | `{ sessionId, isOfferer, iceServers, reportToken, peerNickname, peerGender, peerRegion }` | Eşleşme kuruldu. `isOfferer=true` ise SEN offer üretirsin. `iceServers` STUN/TURN listesi. **`reportToken`**: bu kişiyi report/block etmek için sakla (REST'te gönderilir). |
| `offer` | `{ sessionId, sdp: { type, sdp } }` | Karşıdan gelen offer. |
| `answer` | `{ sessionId, sdp: { type, sdp } }` | Karşıdan gelen answer. |
| `ice-candidate` | `{ sessionId, candidate }` | Karşıdan gelen ICE. |
| `peer-left` | `{ sessionId, reason }` | Karşı taraf ayrıldı (`reason`: `skip\|leave\|disconnect\|block\|reconnect`). |
| `force-disconnect` | `{ sessionId, reason }` | Sen zorla düşürüldün (`reason`: `report\|reconnect`). |
| `banned` | `{ reason, expiresAt }` | Banlısın. `expiresAt=null` → kalıcı. |
| `error` | `{ message }` | Genel hata. |

### Tipik akış (state machine)
```
connect → join-queue → (waiting | match-found)
  match-found(isOfferer=true)  → createOffer → emit offer → on answer → on ice-candidate
  match-found(isOfferer=false) → on offer → createAnswer → emit answer → on ice-candidate
  → P2P bağlandı (chat DataChannel açılır)
  → skip/leave/block/report/peer-left → tekrar join-queue
```

---

## 2. REST API

Base: `/api` — Content-Type: `application/json`

| Method | Path | Body | Yanıt | Not |
|---|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` | Liveness. |
| GET | `/api/ice-config` | — | `{ iceServers: [...] }` | STUN/TURN listesi. **Faz 1'de TURN credential'ları buraya gelecek.** |
| POST | `/api/ban-check` | `{ deviceId }` | `{ isBanned, reason?, expiresAt? }` | Uygulama açılışında çağrılır. |
| POST | `/api/report` | `{ reportToken, reason }` | `{ ok, reportCount, banResult }` | ✅ `reportToken` (match-found'dan) doğrulanır → sadece eşleştiğin kişiyi raporlarsın (IDOR kapalı). |
| POST | `/api/block` | `{ reportToken }` | `{ ok }` | ✅ `reportToken` doğrulanır (IDOR kapalı). |
| POST | `/api/moderation-flag` | `{ deviceId, sessionId, imageBase64 }` | `{ flagged, forceDisconnect }` | İstemci ML şüphesinde çağırır. |

---

## 3. Web istemcisinin Android'den farkları (arkadaşın için notlar)

1. **WebRTC API'leri tarayıcıda hazır** (`RTCPeerConnection`, `getUserMedia`, `RTCDataChannel`) — kütüphane gerekmez. Event isimleri ve SDP/ICE formatı **birebir aynı** (yukarıdaki tablo geçerli).
2. **`deviceId`** → `localStorage.getItem('deviceId') ?? crypto.randomUUID()` ile üret ve sakla.
3. **Chat** → `pc.createDataChannel('chat', { ordered: true })`. Offerer oluşturur, answerer `pc.ondatachannel` ile yakalar. (Android bunu böyle yapıyor.)
4. **`iceServers`'ı `match-found` payload'ından al** — hardcode etme (TURN gelince otomatik çalışsın).
5. **CORS:** Backend şu an `origin:'*'`. Auth eklenince web domain'i **whitelist'e** eklenmeli — arkadaş domain'ini backend sahibine bildirmeli.

---

## 4. PLANLANAN — Faz 1 auth şeması (henüz YOK, ikiniz de buna göre kodlayın)

Report/block istismarını kapatmak için oturum tabanlı imza gelecek:
- `join-queue` başarılı olunca sunucu `match-found` içinde kısa ömürlü bir `sessionToken` döndürecek.
- `report`/`block` çağrılarında bu token gönderilecek; sunucu "bu kişi gerçekten o session'daydı" doğrulamasını yapacak.
- **İki istemci de** bu token'ı saklayıp geri göndermeye hazır yazılmalı.

> Bu bölüm hayata geçtiğinde protokol **v2** olur ve bu dosya güncellenir.
