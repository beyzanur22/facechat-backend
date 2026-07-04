const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

// Fail-fast: Redis adresi yoksa net mesajla dur.
if (!config.redisUrl) {
  throw new Error(
    'REDIS_URL tanımlı değil. .env dosyanıza Upstash Redis adresini ekleyin (rediss://... ile başlar).'
  );
}

// Uygulama komutları (kuyruk, ban cache, presence) için ana istemci.
// maxRetriesPerRequest: null → bağlantı koptuğunda komutları atmak yerine yeniden bağlanmayı bekler.
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('connect', () => logger.info('[redis] bağlandı'));
redis.on('error', (err) => logger.error('[redis] hata:', err.message));

module.exports = redis;
