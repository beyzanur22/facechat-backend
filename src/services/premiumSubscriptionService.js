const db = require('../db');
const redis = require('../redis');
const purchaseVerification = require('./purchaseVerificationService');

const premiumCacheKey = (deviceId) => `cache:premium:${deviceId}`;

/**
 * Satın alma makbuzunu doğrular, geçerliyse premium_subscriptions'a yazar ve
 * users.is_premium/premium_until'i günceller. purchase_token UNIQUE olduğundan
 * aynı makbuz iki kez kullanılırsa (23505) reddedilir — replay/hile engeli.
 */
async function redeemPurchase({ deviceId, provider, productId, purchaseToken }) {
  const user = await db('users').where({ device_id: deviceId }).first();
  if (!user) {
    return { ok: false, error: 'Kullanıcı bulunamadı' };
  }

  const result = await purchaseVerification.verify({ provider, productId, purchaseToken });
  if (!result.valid) {
    return { ok: false, error: 'Makbuz doğrulanamadı' };
  }

  try {
    await db('premium_subscriptions').insert({
      user_id: user.id,
      provider,
      product_id: productId,
      purchase_token: purchaseToken,
      status: 'active',
      expires_at: result.expiresAt,
    });
  } catch (err) {
    if (err.code === '23505') {
      return { ok: false, error: 'Bu makbuz zaten kullanılmış' };
    }
    throw err;
  }

  await db('users').where({ device_id: deviceId }).update({
    is_premium: true,
    premium_until: result.expiresAt,
  });
  await redis.del(premiumCacheKey(deviceId));

  return { ok: true, expiresAt: result.expiresAt };
}

module.exports = { redeemPurchase };
