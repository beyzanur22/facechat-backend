const redis = require('../redis');

/**
 * Eşleştirme kuyruğu — artık RAM'de değil, Redis'te (tüm sunucular ortak kullanır).
 * mm:waiting  → ZSET (socketId, score=joinedAt) : FIFO sıralama
 * mm:entry:{socketId} → JSON entry
 * mm:device:{deviceId} → o cihazın bekleyen socketId'si (reconnect temizliği için)
 */
const WAITING = 'mm:waiting';
const entryKey = (sid) => `mm:entry:${sid}`;
const deviceKey = (did) => `mm:device:${did}`;
const ENTRY_TTL = 300; // sn — hayalet kayıtlar için güvenlik ağı

async function add(entry) {
  const joinedAt = Date.now();
  const data = JSON.stringify({ ...entry, joinedAt });
  await redis
    .multi()
    .zadd(WAITING, joinedAt, entry.socketId)
    .set(entryKey(entry.socketId), data, 'EX', ENTRY_TTL)
    .set(deviceKey(entry.deviceId), entry.socketId, 'EX', ENTRY_TTL)
    .exec();
}

async function remove(socketId) {
  const raw = await redis.get(entryKey(socketId));
  const pipe = redis.multi().zrem(WAITING, socketId).del(entryKey(socketId));
  if (raw) {
    try {
      pipe.del(deviceKey(JSON.parse(raw).deviceId));
    } catch (_) {
      /* bozuk kayıt, yoksay */
    }
  }
  await pipe.exec();
}

/** Aynı deviceId'nin (verilen socket hariç) bekleyen kaydını siler; silinen socketId'leri döner. */
async function removeByDeviceId(deviceId, exceptSocketId) {
  const sid = await redis.get(deviceKey(deviceId));
  if (!sid || sid === exceptSocketId) return [];
  await remove(sid);
  return [sid];
}

async function get(socketId) {
  const raw = await redis.get(entryKey(socketId));
  return raw ? JSON.parse(raw) : null;
}

/** joinedAt'e göre sıralı, verilen socketId hariç bekleyenler. */
async function waitingExcept(socketId) {
  const ids = await redis.zrange(WAITING, 0, -1); // score (joinedAt) artan → FIFO
  const others = ids.filter((id) => id !== socketId);
  if (others.length === 0) return [];

  const raws = await redis.mget(others.map(entryKey));
  const entries = [];
  const stale = [];
  others.forEach((id, i) => {
    if (raws[i]) entries.push(JSON.parse(raws[i]));
    else stale.push(id); // entry TTL ile düştü ama zset üyesi kaldı
  });
  if (stale.length) redis.zrem(WAITING, ...stale).catch(() => {});
  return entries;
}

async function size() {
  return redis.zcard(WAITING);
}

module.exports = { add, remove, removeByDeviceId, get, waitingExcept, size };
