const redis = require('../redis');
const config = require('../config');
const logger = require('../utils/logger');
const { clientIpFromSocket, hashIp } = require('../utils/ip');

/**
 * IP-hash başına eşzamanlı socket bağlantı limiti (flood/DoS koruması).
 * Bağlantılar `conn:{ipHash}` ZSET'inde tutulur (member=socketId, score=bağlanma zamanı).
 * Doğru sayaç: disconnect'te ZREM. Crash-leak backstop: her yeni bağlantıda STALE_MS'ten
 * eski üyeler budanır (sunucu çökerse ZREM çalışmaz → şişmeyi sınırlar).
 * STALE_MS, oda TTL'inden (4s) büyük seçildi ki uzun bir görüşme yanlışlıkla budanmasın.
 */
const STALE_MS = 6 * 60 * 60 * 1000; // 6 saat
const key = (ipHash) => `conn:${ipHash}`;

// Atomik kabul kararı: budama + sayım + ekleme TEK Redis işleminde yapılır. Aksi halde eş
// zamanlı bağlantılar "önce say sonra ekle" arasındaki yarışta (TOCTOU) limiti aşabilir.
// Dönüş: 1 = kabul, 0 = reddet (limit dolu).
const ADMIT_LUA = `
local minScore = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local maxConn = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, minScore)
local count = redis.call('ZCARD', KEYS[1])
if count >= maxConn then
  return 0
end
redis.call('ZADD', KEYS[1], now, member)
redis.call('EXPIRE', KEYS[1], ttl)
return 1
`;

// Socket.io io.use() middleware'i olarak takılır.
async function guard(socket, next) {
  try {
    const ipHash = hashIp(clientIpFromSocket(socket));
    socket.data.ipHash = ipHash;

    const now = Date.now();
    const admitted = await redis.eval(
      ADMIT_LUA,
      1,
      key(ipHash),
      now - STALE_MS,
      now,
      config.maxConnPerIp,
      socket.id,
      Math.ceil(STALE_MS / 1000)
    );

    if (admitted !== 1) {
      logger.warn('bağlantı limiti aşıldı, handshake reddedildi', { ipHash });
      return next(new Error('too_many_connections'));
    }
    return next();
  } catch (err) {
    // Fail-open: limiter'ın kendi hatası meşru kullanıcıyı dışarıda bırakmasın.
    logger.error('connectionLimiter guard hatası', err);
    return next();
  }
}

/** disconnect'te çağrılır — bağlantıyı sayaçtan düşer. */
async function release(socket) {
  try {
    const ipHash = socket.data && socket.data.ipHash;
    if (ipHash) await redis.zrem(key(ipHash), socket.id);
  } catch (err) {
    logger.debug('connectionLimiter release hatası', err.message);
  }
}

module.exports = { guard, release };
