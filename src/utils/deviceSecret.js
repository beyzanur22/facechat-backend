const crypto = require('crypto');

/**
 * Cihaz sahiplik kanıtı: rastgele bir secret bir kez üretilir, hash'i DB'ye yazılır,
 * düz metin SADECE ilk kayıtta istemciye döner (reportToken deseniyle aynı fikir:
 * yalnızca gerçek sahibin ilk temasta yakalayabileceği bir sır).
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Timing-safe karşılaştırma — hash uzunlukları farklıysa da süre sızdırmaz. */
function verifySecret(secret, storedHash) {
  if (!secret || !storedHash) return false;
  const candidate = hashSecret(secret);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { generateSecret, hashSecret, verifySecret };
