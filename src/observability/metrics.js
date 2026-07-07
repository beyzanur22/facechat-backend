const client = require('prom-client');
const queue = require('../matchmaking/queue');
const redis = require('../redis');
const logger = require('../utils/logger');

// Prometheus metrikleri. GET /metrics (adminAuth ile korunur) bunları sunar.
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // event loop lag, bellek, GC, cpu vb.

// --- Gauge'lar: scrape anında canlı okunur (Redis'ten) ---
const waitingSize = new client.Gauge({
  name: 'facechat_mm_waiting_size',
  help: 'Eşleştirme kuyruğunda bekleyen kullanıcı sayısı',
  registers: [register],
  async collect() {
    try {
      this.set(await queue.size());
    } catch (_) {
      /* Redis geçici erişilemezse metrik atlansın, uygulamayı etkilemesin */
    }
  },
});

const activeRooms = new client.Gauge({
  name: 'facechat_active_rooms',
  help: 'Aktif (devam eden) görüşme odası sayısı',
  registers: [register],
  async collect() {
    try {
      const v = await redis.get('metric:active_rooms');
      this.set(Number(v) || 0);
    } catch (_) {
      /* yoksay */
    }
  },
});

// --- Counter'lar: olay anında artırılır ---
const matchesTotal = new client.Counter({
  name: 'facechat_matches_total',
  help: 'Kurulan toplam eşleşme (oda) sayısı',
  registers: [register],
});
const reportsTotal = new client.Counter({
  name: 'facechat_reports_total',
  help: 'Açılan toplam şikayet sayısı',
  registers: [register],
});
const bansTotal = new client.Counter({
  name: 'facechat_bans_total',
  help: 'Uygulanan toplam ban sayısı',
  registers: [register],
});
const socketConnectionsTotal = new client.Counter({
  name: 'facechat_socket_connections_total',
  help: 'Toplam socket bağlantısı sayısı',
  registers: [register],
});

// Aktif oda gauge'ını Redis sayacıyla senkron tutan yardımcılar (room.js kullanır).
async function roomOpened() {
  try {
    await redis.incr('metric:active_rooms');
  } catch (err) {
    logger.debug('[metrics] roomOpened redis hatası', err.message);
  }
}
async function roomClosed() {
  try {
    // Negatife düşmesin (yarış/çift-kapanış güvenliği).
    const v = await redis.decr('metric:active_rooms');
    if (v < 0) await redis.set('metric:active_rooms', 0);
  } catch (err) {
    logger.debug('[metrics] roomClosed redis hatası', err.message);
  }
}

module.exports = {
  register,
  matchesTotal,
  reportsTotal,
  bansTotal,
  socketConnectionsTotal,
  waitingSize,
  activeRooms,
  roomOpened,
  roomClosed,
};
