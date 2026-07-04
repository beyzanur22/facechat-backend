const db = require('../db');
const banService = require('./banService');

async function stats() {
  const [u] = await db('users').count({ c: '*' });
  const [b] = await db('bans').count({ c: '*' });
  const [r] = await db('reports').count({ c: '*' });
  return { users: Number(u.c), bans: Number(b.c), reports: Number(r.c) };
}

/** Aktif (süresi dolmamış) banlar. */
async function listBans(limit = 100) {
  const now = new Date().toISOString();
  return db('bans')
    .where((b) => b.whereNull('expires_at').orWhere('expires_at', '>', now))
    .orderBy('banned_at', 'desc')
    .limit(limit);
}

async function recentReports(limit = 50) {
  return db('reports').orderBy('created_at', 'desc').limit(limit);
}

/** En çok raporlanan cihazlar (son N saat) — moderatörün önceliklendirmesi için. */
async function reportSummary(hours = 24, limit = 50) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  return db('reports')
    .where('created_at', '>=', since)
    .groupBy('reported_device_id')
    .select('reported_device_id')
    .count({ count: '*' })
    .orderBy('count', 'desc')
    .limit(limit);
}

async function manualBan(deviceId, reason, durationMinutes) {
  const expiresAt = durationMinutes
    ? new Date(Date.now() + Number(durationMinutes) * 60000).toISOString()
    : null; // süresiz
  await db('bans').insert({
    device_id: deviceId,
    ip_hash: null,
    reason: reason || 'admin_ban',
    report_count: 0,
    expires_at: expiresAt,
  });
  await banService.invalidateBanCache(deviceId);
  return { deviceId, expiresAt };
}

async function unban(deviceId) {
  const removed = await db('bans').where({ device_id: deviceId }).del();
  await banService.invalidateBanCache(deviceId);
  return { deviceId, removed };
}

module.exports = { stats, listBans, recentReports, reportSummary, manualBan, unban };
