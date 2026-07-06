const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../../redis');

// Redis-backed store: Render'da birden fazla instance çalışsa bile limit paylaşılır
// (önceki in-memory store, her instance'ın kendi sayacını tutması nedeniyle N instance'da
// limiti N katına çıkarıyordu).
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    prefix: 'rl:api:',
    sendCommand: (...args) => redis.call(...args),
  }),
});

module.exports = apiRateLimiter;
