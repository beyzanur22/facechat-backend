const express = require('express');
const reportService = require('../../services/reportService');
const reportTokenService = require('../../services/reportTokenService');
const logger = require('../../utils/logger');

const router = express.Router();

// body: { reportToken, reason }
// reportToken eşleşme anında verilir → sadece eşleştiğin kişiyi raporlayabilirsin (IDOR kapalı).
router.post('/', async (req, res) => {
  const { reportToken, reason } = req.body || {};
  if (!reportToken) {
    return res.status(400).json({ error: 'reportToken zorunlu' });
  }

  try {
    const ctx = await reportTokenService.verify(reportToken);
    if (!ctx) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş reportToken' });
    }

    // Kimin kimi raporladığı token'dan gelir — body'ye GÜVENİLMEZ.
    const result = await reportService.fileReport({
      reporterDeviceId: ctx.selfDeviceId,
      reportedDeviceId: ctx.peerDeviceId,
      sessionId: ctx.sessionId,
      reason: reason || 'unspecified',
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error('POST /api/report error', err);
    return res.status(500).json({ error: 'Report kaydedilemedi' });
  }
});

module.exports = router;
