const db = require('../db');
const config = require('../config');

async function isBanned(deviceId, ipHash) {
  const now = new Date().toISOString();
  const query = db('bans')
    .where((builder) => {
      builder.where('device_id', deviceId);
      if (ipHash) {
        builder.orWhere('ip_hash', ipHash);
      }
    })
    .andWhere((builder) => {
      builder.whereNull('expires_at').orWhere('expires_at', '>', now);
    })
    .first();

  const ban = await query;
  return ban || null;
}

async function autoban(deviceId, ipHash, reason, reportCount = 0) {
  const existing = await db('bans').where({ device_id: deviceId }).first();
  const isRepeatOffender = Boolean(existing);

  const expiresAt = isRepeatOffender
    ? null // kalıcı ban
    : new Date(Date.now() + config.autoBanFirstDurationMinutes * 60 * 1000).toISOString();

  await db('bans').insert({
    device_id: deviceId,
    ip_hash: ipHash || null,
    reason,
    report_count: reportCount,
    expires_at: expiresAt,
  });

  return { permanent: isRepeatOffender, expiresAt };
}

module.exports = { isBanned, autoban };
