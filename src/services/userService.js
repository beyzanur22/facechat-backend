const db = require('../db');
const redis = require('../redis');
const { generateSecret, hashSecret } = require('../utils/deviceSecret');

// Premium durumu cache'i (ban cache ile aynı mantık: cache-aside + write-through invalidation).
const premiumCacheKey = (deviceId) => `cache:premium:${deviceId}`;
const PREMIUM_TTL = 120; // sn

/** Misafir dahil: deviceId için satır yoksa oluşturur (yarış-güvenli upsert). */
async function findOrCreateByDevice(deviceId) {
  await db('users').insert({ device_id: deviceId }).onConflict('device_id').ignore();
  return db('users').where({ device_id: deviceId }).first();
}

/**
 * Cihaz sahiplik kaydı (IDOR koruması). İstemci deviceId'yi ürettiğinde bir kez çağırır.
 * Satır yoksa oluşturur; device_secret_hash henüz atanmamışsa atomik olarak "claim" eder
 * (WHERE device_secret_hash IS NULL) ve düz metin secret'ı SADECE bu ilk claim'de döner.
 * Zaten claim edilmişse (örn. daha önce Google login ile satır oluşmuşsa) tekrar secret
 * vermez — aksi halde deviceId'yi bilen herkes sonradan secret alabilirdi.
 */
async function registerDevice(deviceId, birthdate) {
  await db('users').insert({ device_id: deviceId }).onConflict('device_id').ignore();

  // Doğum tarihi write-once: yalnızca henüz boşsa yazılır (kullanıcı sonradan yaşını
  // değiştirip yaş kapısını atlayamasın).
  if (birthdate) {
    await db('users')
      .where({ device_id: deviceId })
      .whereNull('birthdate')
      .update({ birthdate });
  }

  const secret = generateSecret();
  const secretHash = hashSecret(secret);
  const claimed = await db('users')
    .where({ device_id: deviceId, device_secret_hash: null })
    .update({ device_secret_hash: secretHash })
    .returning('id');

  return claimed.length > 0 ? { claimed: true, deviceSecret: secret } : { claimed: false };
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

/**
 * KVKK "hesabımı sil" — hard delete DEĞİL. Satır (device_id, ban geçmişi) kalır çünkü:
 * 1) bans/reports/blocks tabloları buna FK ile bağlı (RESTRICT) — silinirse hata alınır,
 * 2) banlı biri hesabını silip aynı cihazdan ban'dan kaçamasın (platform güvenliği).
 * Sadece kişisel alanlar (email/isim/google bağlantısı) temizlenir.
 */
async function softDeleteUser(deviceId) {
  await db('users').where({ device_id: deviceId }).update({
    email: null,
    display_name: null,
    google_id: null,
    deleted_at: db.fn.now(),
  });
  await redis.del(premiumCacheKey(deviceId));
}

module.exports = { findOrCreateByDevice, registerDevice, linkAccount, getPremium, softDeleteUser };
