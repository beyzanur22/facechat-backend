const express = require('express');
const reportService = require('../../services/reportService');
const logger = require('../../utils/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const { sessionId, reporterDeviceId, reportedDeviceId, reason } = req.body || {};

  if (!sessionId || !reporterDeviceId || !reportedDeviceId) {
    return res.status(400).json({ error: 'sessionId, reporterDeviceId ve reportedDeviceId zorunlu' });
  }

  try {
    const result = await reportService.fileReport({
      reporterDeviceId,
      reportedDeviceId,
      sessionId,
      reason: reason || 'unspecified',
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error('POST /api/report error', err);
    return res.status(500).json({ error: 'Report kaydedilemedi' });
  }
});

module.exports = router;
