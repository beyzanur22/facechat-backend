// Gerçek Upstash Redis'e bağlanmadan test etmek için: src/redis modülünü ioredis-mock ile
// değiştirir. Bu dosya, redis'e bağımlı modüller (queue/room/velocity) require EDİLMEDEN
// ÖNCE require edilmeli. node --test her dosyayı ayrı process'te çalıştırdığı için izole.
const RedisMock = require('ioredis-mock');

const redisPath = require.resolve('../../src/redis');
const mock = new RedisMock();
require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: mock };

module.exports = mock;
