const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const redis = require('./helpers/injectRedis');
const velocity = require('../src/services/velocityService');

beforeEach(async () => {
  await redis.flushall();
});

test('hit: limit içinde true, aşınca false', async () => {
  assert.equal(await velocity.hit('d1', 'join', 60, 3), true); // 1
  assert.equal(await velocity.hit('d1', 'join', 60, 3), true); // 2
  assert.equal(await velocity.hit('d1', 'join', 60, 3), true); // 3
  assert.equal(await velocity.hit('d1', 'join', 60, 3), false); // 4 > max
});

test('hit: farklı cihaz/aksiyon ayrı sayaç', async () => {
  assert.equal(await velocity.hit('d1', 'join', 60, 1), true);
  assert.equal(await velocity.hit('d1', 'join', 60, 1), false);
  // farklı device → temiz sayaç
  assert.equal(await velocity.hit('d2', 'join', 60, 1), true);
  // farklı action → temiz sayaç
  assert.equal(await velocity.hit('d1', 'modflag', 60, 1), true);
});
