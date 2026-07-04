const redis = require('../redis');

/**
 * Cihaz bazlı hız limiti (Redis). Per-socket limitin ÖTESİNDE: aynı cihaz birçok
 * soketle yeniden bağlanıp spam yapamaz. Sabit pencere sayacı.
 * Dönüş: true = izinli, false = limit aşıldı.
 */
async function hit(deviceId, action, windowSec, max) {
  const key = `vel:${action}:${deviceId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return count <= max;
}

module.exports = { hit };
