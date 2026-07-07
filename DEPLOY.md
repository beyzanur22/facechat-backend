# Deploy Notları (Render)

## Migration'lar artık uygulama başlangıcından AYRI

`npm start` sadece `node src/server.js` çalıştırır (migration YOK). Bunun nedeni: birden
fazla instance aynı anda açılınca `migrate:latest` yarışa girip deploy'u bozabiliyordu.

### Render ayarı (ZORUNLU)
Render servisinde **Settings → Pre-Deploy Command** alanına şunu gir:

```
npm run migrate
```

Böylece migration'lar deploy başına **bir kez**, uygulama başlamadan önce çalışır. Yatay
ölçekte (2+ instance) güvenlidir.

> Pre-Deploy Command'i AYARLAMAZSAN yeni migration'lar (ör. `011_add_user_birthdate`)
> production'da çalışmaz ve ilgili kolonlar eksik kalır. Bu adımı atlama.

## Gerekli / yeni environment değişkenleri

Fail-fast (yoksa uygulama açılmaz):
- `DATABASE_URL`, `REDIS_URL`, `IP_HASH_SALT`

Güvenlik / admin:
- `ADMIN_TOKEN` — admin paneli + `/metrics` erişimi (openssl rand -hex 32)
- `CORS_ORIGINS` — web domain gelince kilitle (Android'i etkilemez)

Yeni eklenenler (hepsi güvenli varsayılanlı, opsiyonel):
- `SENTRY_DSN` — girilince hata izleme aktif olur (boşsa kapalı)
- `MAX_CONN_PER_IP` (varsayılan 20) — IP başına eşzamanlı socket limiti
- `POOL_MIN` / `POOL_MAX` (varsayılan 2 / 10) — DB bağlantı havuzu
- `MIN_AGE` (varsayılan 18) — sunucu-tarafı yaş kapısı (0 = kapalı)
- `LOG_LEVEL` (varsayılan prod'da info) — pino log seviyesi
- `MODERATION_PROVIDER` (`none` | `sightengine`) + `MODERATION_API_USER` + `MODERATION_API_KEY`
- `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` — kendi coturn'ünü alınca doldur

## /metrics (Prometheus)

`GET /metrics` `ADMIN_TOKEN` ile korunur. Prometheus scrape config'inde:

```yaml
scrape_configs:
  - job_name: facechat
    bearer_token: <ADMIN_TOKEN>
    static_configs:
      - targets: ['facechat-backend.onrender.com']
```

Özel metrikler: `facechat_mm_waiting_size`, `facechat_active_rooms`,
`facechat_matches_total`, `facechat_reports_total`, `facechat_bans_total`,
`facechat_socket_connections_total` (+ Node.js default metrikleri).
