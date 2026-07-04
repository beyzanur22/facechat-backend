const db = require('../db');
const config = require('../config');
const banService = require('./banService');
const { normalizeReason } = require('../validation/schemas');

async function fileReport({ reporterDeviceId, reportedDeviceId, sessionId, reason }) {
  await db('reports').insert({
    reporter_device_id: reporterDeviceId,
    reported_device_id: reportedDeviceId,
    session_id: sessionId,
    reason: normalizeReason(reason),
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }] = await db('reports')
    .where({ reported_device_id: reportedDeviceId })
    .andWhere('created_at', '>=', since)
    .count({ count: '*' });

  const reportCount = Number(count);
  let banResult = null;
  if (reportCount >= config.reportThreshold24h) {
    banResult = await banService.autoban(reportedDeviceId, null, 'report_threshold_exceeded', reportCount);
  }

  return { reportCount, banResult };
}

module.exports = { fileReport };
