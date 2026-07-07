const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const redis = require('./helpers/injectRedis');
const rooms = require('../src/matchmaking/room');

beforeEach(async () => {
  await redis.flushall();
});

test('create sonrası session/socket/device lookup çalışır', async () => {
  const room = await rooms.create(
    { socketId: 'sa', deviceId: 'da' },
    { socketId: 'sb', deviceId: 'db' }
  );
  assert.ok(room.sessionId);

  const bySession = await rooms.getBySessionId(room.sessionId);
  assert.equal(bySession.socketIdA, 'sa');

  const bySocket = await rooms.getBySocketId('sb');
  assert.equal(bySocket.sessionId, room.sessionId);

  const byDevice = await rooms.getByDeviceId('da');
  assert.equal(byDevice.sessionId, room.sessionId);

  assert.equal(await rooms.otherSocketId(room.sessionId, 'sa'), 'sb');
  assert.equal(await rooms.otherSocketId(room.sessionId, 'sb'), 'sa');
});

test('active_rooms metrik sayacı create/end ile senkron', async () => {
  const room = await rooms.create({ socketId: 'sa', deviceId: 'da' }, { socketId: 'sb', deviceId: 'db' });
  assert.equal(Number(await redis.get('metric:active_rooms')), 1);

  await rooms.end(room.sessionId);
  assert.equal(await rooms.getBySessionId(room.sessionId), null);
  assert.equal(Number(await redis.get('metric:active_rooms')), 0);
});

test('end olmayan oda için no-op (sayaç negatife düşmez)', async () => {
  await rooms.end('yok-boyle-session');
  const v = Number(await redis.get('metric:active_rooms')) || 0;
  assert.equal(v >= 0, true);
});
