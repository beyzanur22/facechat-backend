const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../../redis');

// Genel /api limitinden (60sn'de 30) ayrı, daha sıkı: ADMIN_TOKEN'ı brute-force
// denemeye çalışan biri dakikada sadece 20 deneme yapabilsin. Redis-backed (bkz. rateLimiter.js).
const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'rl:admin:',
    sendCommand: (...args) => redis.call(...args),
  }),
});

module.exports = adminRateLimiter;
