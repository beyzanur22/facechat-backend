const db = require('../db');
const redis = require('../redis');

// Premium durumu cache'i (ban cache ile aynı mantık: cache-aside + write-through invalidation).
const premiumCacheKey = (deviceId) => `cache:premium:${deviceId}`;
const PREMIUM_TTL = 120; // sn

/** Misafir dahil: deviceId için satır yoksa oluşturur (yarış-güvenli upsert). */
async function findOrCreateByDevice(deviceId) {
  await db('users').insert({ device_id: deviceId }).onConflict('device_id').ignore();
  return db('users').where({ device_id: deviceId }).first();
}

/** Google (Supabase) hesabını deviceId'ye bağlar / günceller. */
async function linkAccount(deviceId, { authUid, email, displayName }) {
  await findOrCreateByDevice(deviceId);
  await db('users').where({ device_id: deviceId }).update({
    google_id: authUid,
    email,
    display_name: displayName,
    last_seen_at: db.fn.now(),
  });
  await redis.del(premiumCacheKey(deviceId)); // premium tekrar okunsun
  return db('users').where({ device_id: deviceId }).first();
}

/** Premium mi? (cache-aside) — misafirde satır yoksa false. */
async function getPremium(deviceId) {
  const cached = await redis.get(premiumCacheKey(deviceId));
  if (cached !== null) return cached === '1';

  const user = await db('users').where({ device_id: deviceId }).first();
  const isPremium = Boolean(
    user && user.is_premium && (!user.premium_until || new Date(user.premium_until) > new Date())
  );
  await redis.set(premiumCacheKey(deviceId), isPremium ? '1' : '0', 'EX', PREMIUM_TTL);
  return isPremium;
}

module.exports = { findOrCreateByDevice, linkAccount, getPremium };
