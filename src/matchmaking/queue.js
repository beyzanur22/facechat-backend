/**
 * In-memory eşleştirme kuyruğu. DB'ye hiç yazılmaz, sadece RAM'de tutulur.
 * QueueEntry: { socketId, deviceId, gender, region, filterGender, filterRegion, joinedAt }
 */
class MatchQueue {
  constructor() {
    /** @type {Map<string, object>} socketId -> entry */
    this.entries = new Map();
  }

  add(entry) {
    this.entries.set(entry.socketId, { ...entry, joinedAt: Date.now() });
  }

  remove(socketId) {
    this.entries.delete(socketId);
  }

  /** Aynı deviceId'ye ait (verilen socket hariç) tüm kuyruk kayıtlarını siler; silinen socketId'leri döner. */
  removeByDeviceId(deviceId, exceptSocketId) {
    const removed = [];
    for (const [socketId, entry] of this.entries) {
      if (entry.deviceId === deviceId && socketId !== exceptSocketId) {
        this.entries.delete(socketId);
        removed.push(socketId);
      }
    }
    return removed;
  }

  has(socketId) {
    return this.entries.has(socketId);
  }

  get(socketId) {
    return this.entries.get(socketId);
  }

  /** joinedAt'e göre sıralı, verilen socketId hariç bekleyenler */
  waitingExcept(socketId) {
    return [...this.entries.values()]
      .filter((e) => e.socketId !== socketId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }

  size() {
    return this.entries.size;
  }
}

module.exports = new MatchQueue();
