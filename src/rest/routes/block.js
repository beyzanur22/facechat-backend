const express = require('express');
const blockService = require('../../services/blockService');
const reportTokenService = require('../../services/reportTokenService');
const logger = require('../../utils/logger');

const router = express.Router();

// body: { reportToken } — sadece eşleştiğin kişiyi engelleyebilirsin (IDOR kapalı).
router.post('/', async (req, res) => {
  const { reportToken } = req.body || {};
  if (!reportToken) {
    return res.status(400).json({ error: 'reportToken zorunlu' });
  }

  try {
    const ctx = await reportTokenService.verify(reportToken);
    if (!ctx) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş reportToken' });
    }

    await blockService.addBlock(ctx.selfDeviceId, ctx.peerDeviceId);
    return res.json({ ok: true });
  } catch (err) {
    logger.error('POST /api/block error', err);
    return res.status(500).json({ error: 'Block kaydedilemedi' });
  }
});

module.exports = router;
