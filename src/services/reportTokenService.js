const { randomUUID } = require('crypto');
const redis = require('../redis');

/**
 * Session-token (report/block yetkisi). Eşleşme anında her katılımcıya verilir ve
 * SADECE eşleştiği kişiyi report/block etmeye yetki verir → IDOR/report-abuse kapanır.
 * Redis'te tutulur, kısa ömürlüdür (görüşme sonrası kısa süre raporlamaya izin verir).
 */
const key = (token) => `report_token:${token}`;
const TTL = 60 * 60; // 1 saat

async function issue(sessionId, selfDeviceId, peerDeviceId) {
  const token = randomUUID();
  await redis.set(key(token), JSON.stringify({ sessionId, selfDeviceId, peerDeviceId }), 'EX', TTL);
  return token;
}

/** Geçerliyse { sessionId, selfDeviceId, peerDeviceId } döner, değilse null. */
async function verify(token) {
  if (!token) return null;
  const raw = await redis.get(key(token));
  return raw ? JSON.parse(raw) : null;
}

module.exports = { issue, verify };
