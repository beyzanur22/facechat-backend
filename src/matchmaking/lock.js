const { randomUUID } = require('crypto');
const redis = require('../redis');

/**
 * Basit dağıtık kilit (Redis SET NX PX). Eşleştirmeyi tüm sunucular arasında
 * sıraya sokar → aynı bekleyen kullanıcı iki farklı kişiyle eşleşemez.
 */
const LOCK_KEY = 'mm:lock';
const LOCK_TTL_MS = 3000; // kilidi tutan sunucu çökerse otomatik serbest kalır

async function acquire(retries = 50, delayMs = 20) {
  const token = randomUUID();
  for (let i = 0; i < retries; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX');
    if (ok === 'OK') return token;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// Sadece kilit bizimse sil (başkasının kilidini silmeyi önlemek için atomik Lua).
const RELEASE_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

async function release(token) {
  if (!token) return;
  try {
    await redis.eval(RELEASE_LUA, 1, LOCK_KEY, token);
  } catch (_) {
    /* kilit zaten düşmüş olabilir, yoksay */
  }
}

module.exports = { acquire, release };
