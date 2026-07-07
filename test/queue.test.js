const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const redis = require('./helpers/injectRedis');
const queue = require('../src/matchmaking/queue');

beforeEach(async () => {
  await redis.flushall();
});

test('add + waitingExcept: kendini hariç tutar, diğerini döner', async () => {
  await queue.add({ socketId: 's1', deviceId: 'd1', gender: 'male' });
  await queue.add({ socketId: 's2', deviceId: 'd2', gender: 'female' });

  const others = await queue.waitingExcept('s1');
  assert.equal(others.length, 1);
  assert.equal(others[0].socketId, 's2');
  assert.equal(await queue.size(), 2);
});

test('waitingExcept FIFO (joinedAt) sırasını korur', async () => {
  await queue.add({ socketId: 'a', deviceId: 'da' });
  await queue.add({ socketId: 'b', deviceId: 'db' });
  await queue.add({ socketId: 'c', deviceId: 'dc' });
  const others = await queue.waitingExcept('x');
  assert.deepEqual(others.map((e) => e.socketId), ['a', 'b', 'c']);
});

test('remove kaydı ve device eşlemesini siler', async () => {
  await queue.add({ socketId: 's1', deviceId: 'd1' });
  await queue.remove('s1');
  assert.equal(await queue.size(), 0);
  assert.equal(await queue.get('s1'), null);
});

test('removeByDeviceId verilen socket hariç eski kaydı siler', async () => {
  await queue.add({ socketId: 'old', deviceId: 'd1' });
  const removed = await queue.removeByDeviceId('d1', 'new');
  assert.deepEqual(removed, ['old']);
  assert.equal(await queue.size(), 0);
});

test('removeByDeviceId aynı socket ise silmez (idempotent reconnect)', async () => {
  await queue.add({ socketId: 'same', deviceId: 'd1' });
  const removed = await queue.removeByDeviceId('d1', 'same');
  assert.deepEqual(removed, []);
  assert.equal(await queue.size(), 1);
});
