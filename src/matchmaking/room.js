const { randomUUID } = require('crypto');

/**
 * Aktif oda/session state yönetimi. RoomState: { sessionId, socketIdA, socketIdB, deviceIdA, deviceIdB, startedAt }
 */
class RoomManager {
  constructor() {
    /** @type {Map<string, object>} sessionId -> RoomState */
    this.rooms = new Map();
    /** @type {Map<string, string>} socketId -> sessionId (hızlı ters lookup) */
    this.socketToSession = new Map();
  }

  create(entryA, entryB) {
    const sessionId = randomUUID();
    const room = {
      sessionId,
      socketIdA: entryA.socketId,
      socketIdB: entryB.socketId,
      deviceIdA: entryA.deviceId,
      deviceIdB: entryB.deviceId,
      startedAt: Date.now(),
    };
    this.rooms.set(sessionId, room);
    this.socketToSession.set(entryA.socketId, sessionId);
    this.socketToSession.set(entryB.socketId, sessionId);
    return room;
  }

  getBySessionId(sessionId) {
    return this.rooms.get(sessionId);
  }

  getBySocketId(socketId) {
    const sessionId = this.socketToSession.get(socketId);
    return sessionId ? this.rooms.get(sessionId) : null;
  }

  getByDeviceId(deviceId) {
    for (const room of this.rooms.values()) {
      if (room.deviceIdA === deviceId || room.deviceIdB === deviceId) return room;
    }
    return null;
  }

  otherSocketId(sessionId, socketId) {
    const room = this.rooms.get(sessionId);
    if (!room) return null;
    return room.socketIdA === socketId ? room.socketIdB : room.socketIdA;
  }

  end(sessionId) {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    this.socketToSession.delete(room.socketIdA);
    this.socketToSession.delete(room.socketIdB);
    this.rooms.delete(sessionId);
  }
}

module.exports = new RoomManager();
