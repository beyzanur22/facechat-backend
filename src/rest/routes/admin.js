const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const admin = require('../../services/adminService');
const logger = require('../../utils/logger');

const router = express.Router();
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
  const { deviceId, reason, durationMinutes } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  try {
    res.json({ ok: true, ...(await admin.manualBan(deviceId, reason, durationMinutes)) });
  } catch (err) {
    logger.error('admin/ban', err);
    res.status(500).json({ error: 'ban uygulanamadı' });
  }
});

router.post('/unban', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  try {
    res.json({ ok: true, ...(await admin.unban(deviceId)) });
  } catch (err) {
    logger.error('admin/unban', err);
    res.status(500).json({ error: 'unban yapılamadı' });
  }
});

module.exports = router;
