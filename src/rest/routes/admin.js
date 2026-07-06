const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const adminRateLimiter = require('../middleware/adminRateLimiter');
const admin = require('../../services/adminService');
const { validateAdminBan } = require('../../validation/schemas');
const logger = require('../../utils/logger');

const router = express.Router();
router.use(adminRateLimiter); // token brute-force'a karşı genel /api limitinden daha sıkı
router.use(adminAuth); // tüm admin route'ları token ister

router.get('/stats', async (_req, res) => {
  try {
    res.json(await admin.stats());
  } catch (err) {
    logger.error('admin/stats', err);
    res.status(500).json({ error: 'stats alınamadı' });
  }
});

router.get('/bans', async (req, res) => {
  try {
    res.json(await admin.listBans(Number(req.query.limit) || 100));
  } catch (err) {
    logger.error('admin/bans', err);
    res.status(500).json({ error: 'banlar alınamadı' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    res.json(await admin.recentReports(Number(req.query.limit) || 50));
  } catch (err) {
    logger.error('admin/reports', err);
    res.status(500).json({ error: 'raporlar alınamadı' });
  }
});

router.get('/reports/summary', async (req, res) => {
  try {
    res.json(await admin.reportSummary(Number(req.query.hours) || 24, Number(req.query.limit) || 50));
  } catch (err) {
    logger.error('admin/reports/summary', err);
    res.status(500).json({ error: 'özet alınamadı' });
  }
});

router.post('/ban', async (req, res) => {
  const validated = validateAdminBan(req.body);
  if (!validated.ok) return res.status(400).json({ error: validated.error });
  const { deviceId, reason, durationMinutes } = validated.value;
  try {
    res.json({ ok: true, ...(await admin.manualBan(deviceId, reason, durationMinutes, req.ipHash)) });
  } catch (err) {
    logger.error('admin/ban', err);
    res.status(500).json({ error: 'ban uygulanamadı' });
  }
});

router.post('/unban', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  try {
    res.json({ ok: true, ...(await admin.unban(deviceId, req.ipHash)) });
  } catch (err) {
    logger.error('admin/unban', err);
    res.status(500).json({ error: 'unban yapılamadı' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    res.json(await admin.recentAuditLog(Number(req.query.limit) || 50));
  } catch (err) {
    logger.error('admin/audit-log', err);
    res.status(500).json({ error: 'audit log alınamadı' });
  }
});

module.exports = router;
