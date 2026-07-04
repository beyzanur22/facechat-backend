const { randomUUID } = require('crypto');
const redis = require('../redis');

/**
 * Aktif oda/session state — Redis'te (sunucular arası paylaşımlı).
 * room:{sessionId} → JSON RoomState
 * room:socket:{socketId} → sessionId  (ters lookup)
 * room:device:{deviceId} → sessionId  (reconnect temizliği)
 */
const roomKey = (sid) => `room:${sid}`;
const socketKey = (sid) => `room:socket:${sid}`;
const deviceKey = (did) => `room:device:${did}`;
const ROOM_TTL = 4 * 60 * 60; // 4 saat — uzun görüşme güvenlik ağı

async function create(entryA, entryB) {
  const sessionId = randomUUID();
  const room = {
    sessionId,
    socketIdA: entryA.socketId,
    socketIdB: entryB.socketId,
    deviceIdA: entryA.deviceId,
    deviceIdB: entryB.deviceId,
    startedAt: Date.now(),
  };
  await redis
    .multi()
    .set(roomKey(sessionId), JSON.stringify(room), 'EX', ROOM_TTL)
    .set(socketKey(entryA.socketId), sessionId, 'EX', ROOM_TTL)
    .set(socketKey(entryB.socketId), sessionId, 'EX', ROOM_TTL)
    .set(deviceKey(entryA.deviceId), sessionId, 'EX', ROOM_TTL)
    .set(deviceKey(entryB.deviceId), sessionId, 'EX', ROOM_TTL)
    .exec();
  return room;
}

async function getBySessionId(sessionId) {
  const raw = await redis.get(roomKey(sessionId));
  return raw ? JSON.parse(raw) : null;
}

async function getBySocketId(socketId) {
  const sessionId = await redis.get(socketKey(socketId));
  return sessionId ? getBySessionId(sessionId) : null;
}

async function getByDeviceId(deviceId) {
  const sessionId = await redis.get(deviceKey(deviceId));
  return sessionId ? getBySessionId(sessionId) : null;
}

async function otherSocketId(sessionId, socketId) {
  const room = await getBySessionId(sessionId);
  if (!room) return null;
  return room.socketIdA === socketId ? room.socketIdB : room.socketIdA;
}

async function end(sessionId) {
  const room = await getBySessionId(sessionId);
  if (!room) return;
  await redis
    .multi()
    .del(roomKey(sessionId))
    .del(socketKey(room.socketIdA))
    .del(socketKey(room.socketIdB))
    .del(deviceKey(room.deviceIdA))
    .del(deviceKey(room.deviceIdB))
    .exec();
}

module.exports = { create, getBySessionId, getBySocketId, getByDeviceId, otherSocketId, end };
