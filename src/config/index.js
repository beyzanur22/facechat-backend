const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

// Fail-fast: tuz tanımlı değilse net mesajla dur (sessizce zayıf sabit değere düşmesin —
// IP hash'lerinin tahmin edilebilir/rainbow-table'a açık olması ban sisteminin güvenini kırar).
if (!process.env.IP_HASH_SALT) {
  throw new Error(
    'IP_HASH_SALT tanımlı değil. .env dosyanıza rastgele, güçlü bir değer ekleyin ' +
      '(ör. `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ile üretebilirsiniz).'
  );
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Postgres bağlantı adresi (ör. postgres://user:pass@host:5432/dbname).
  // Render/Neon/Supabase panelinden alınır ve .env'e yazılır.
  databaseUrl: process.env.DATABASE_URL || '',
  // Bulut Postgres sağlayıcıları SSL ister; kendi lokal Postgres'inde DB_SSL=false yapabilirsin.
  dbSsl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : true,
  // Redis bağlantı adresi (Upstash panelinden — rediss://... ile başlar).
  // Paylaşımlı kuyruk + Socket.io adapter + ban cache burada tutulur.
  redisUrl: process.env.REDIS_URL || '',
  // Supabase Auth: token doğrulama /auth/v1/user endpoint'ine yapılır (anon key public'tir, gizli değil).
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  // TURN (medya relay) — Metered/coturn'dan alınır. Boşsa sadece STUN kullanılır (nazik fallback).
  turnUrls: (process.env.TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  turnUsername: process.env.TURN_USERNAME || '',
  turnCredential: process.env.TURN_CREDENTIAL || '',
  // IP hash tuzu — yukarıdaki fail-fast kontrolü sayesinde burada her zaman dolu.
  ipHashSalt: process.env.IP_HASH_SALT,
  // CORS izinli origin'ler (virgülle). Boşsa herkese izin (dev). Web domain gelince doldur → kilitlenir.
  // Not: Android native istemcide Origin başlığı yok → whitelist onu etkilemez, sadece web'i sınırlar.
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Admin moderasyon API token'ı. BOŞSA admin API tamamen kapalı (fail-closed). Üretimde güçlü değer.
  adminToken: process.env.ADMIN_TOKEN || '',
  moderationProvider: process.env.MODERATION_PROVIDER || 'none',
  moderationApiKey: process.env.MODERATION_API_KEY || '',
  autoBanFirstDurationMinutes: Number(process.env.AUTO_BAN_FIRST_DURATION_MINUTES) || 60,
  reportThreshold24h: Number(process.env.REPORT_THRESHOLD_24H) || 3,
  // Play Console servis hesabı henüz kurulmadı — tanımlı olmadığı sürece premium makbuzları
  // doğrulanamaz (fail-closed, sahte satın alma kabul edilmez). Kurulunca buraya JSON gelecek.
  googlePlayServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '',
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || '',
};
