const db = require('../db');
const config = require('../config');
const redis = require('../redis');
const metrics = require('../observability/metrics');

// --- Ban cache (Redis) ---
// Her join-queue'da ban kontrolü Postgres'i dövmesin diye sonucu kısa süre cache'leriz.
const banCacheKey = (deviceId) => `cache:ban:${deviceId}`;
const NOT_BANNED = '0'; // "banlı değil" işareti
const NOT_BANNED_TTL = 60; // sn — banlı olmayanı kısa süre hatırla
const BANNED_TTL_MAX = 300; // sn — banlıyı en fazla bu kadar cache'le (ban kalkmış olabilir → periyodik tazele)

async function isBanned(deviceId, ipHash) {
  // 1) Önce cache (cache-aside)
  const cached = await redis.get(banCacheKey(deviceId));
  if (cached === NOT_BANNED) return null;
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {
      /* bozuk kayıt → DB'ye düş */
    }
  }

  // 2) MISS → kaynak (Postgres). device_id VEYA ip_hash eşleşirse ve süresi dolmamışsa banlı.
  const now = new Date().toISOString();
  const ban = await db('bans')
    .where((builder) => {
      builder.where('device_id', deviceId);
      if (ipHash) builder.orWhere('ip_hash', ipHash);
    })
    .andWhere((builder) => {
      builder.whereNull('expires_at').orWhere('expires_at', '>', now);
    })
    .first();

  // 3) Sonucu cache'e yaz (TTL ile)
  if (!ban) {
    await redis.set(banCacheKey(deviceId), NOT_BANNED, 'EX', NOT_BANNED_TTL);
    return null;
  }
  const ttl = ban.expires_at
    ? Math.min(BANNED_TTL_MAX, Math.max(1, Math.floor((new Date(ban.expires_at).getTime() - Date.now()) / 1000)))
    : BANNED_TTL_MAX; // kalıcı ban → max TTL ile periyodik tazele
  await redis.set(banCacheKey(deviceId), JSON.stringify(ban), 'EX', ttl);
  return ban;
}

async function autoban(deviceId, ipHash, reason, reportCount = 0) {
  const existing = await db('bans').where({ device_id: deviceId }).first();
  const isRepeatOffender = Boolean(existing);

  const expiresAt = isRepeatOffender
    ? null // kalıcı ban
    : new Date(Date.now() + config.autoBanFirstDurationMinutes * 60 * 1000).toISOString();

  await db('bans').insert({
    device_id: deviceId,
    ip_hash: ipHash || null,
    reason,
    report_count: reportCount,
    expires_at: expiresAt,
  });

  // WRITE-THROUGH INVALIDATION: yeni ban anında etkili olsun → cache'i temizle.
  await redis.del(banCacheKey(deviceId));
  metrics.bansTotal.inc();

  return { permanent: isRepeatOffender, expiresAt };
}

/** Bir cihazın ban cache'ini temizler (elle ban/unban sonrası anında etki için). */
async function invalidateBanCache(deviceId) {
  await redis.del(banCacheKey(deviceId));
}

module.exports = { isBanned, autoban, invalidateBanCache };
