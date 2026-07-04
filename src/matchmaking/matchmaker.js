const queue = require('./queue');
const rooms = require('./room');
const matcher = require('./matcher');
const lock = require('./lock');
const logger = require('../utils/logger');

/**
 * Atomik eşleştirme: kilit altında uygun eş arar.
 * - Eş bulunursa: eşi kuyruktan çıkarır, oda kurar → { match, room } döner.
 * - Bulunmazsa: kendini kuyruğa ekler → null döner.
 * isBlockedPair: async (deviceA, deviceB) => bool
 */
async function joinQueue(entry, isBlockedPair) {
  const token = await lock.acquire();
  if (!token) {
    logger.warn('matchmaking kilidi alınamadı; kullanıcı kuyruğa ekleniyor');
    await queue.add(entry);
    return null;
  }

  try {
    const candidates = await queue.waitingExcept(entry.socketId);
    for (const candidate of candidates) {
      if (!matcher.isMutualMatch(entry, candidate)) continue;
      // eslint-disable-next-line no-await-in-loop
      if (isBlockedPair && (await isBlockedPair(entry.deviceId, candidate.deviceId))) continue;

      await queue.remove(candidate.socketId);
      const room = await rooms.create(entry, candidate);
      return { match: candidate, room };
    }

    await queue.add(entry);
    return null;
  } finally {
    await lock.release(token);
  }
}

module.exports = { joinQueue };
