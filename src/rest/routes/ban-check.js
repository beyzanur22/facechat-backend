const express = require('express');
const banService = require('../../services/banService');
const logger = require('../../utils/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId zorunlu' });
  }

  try {
    const ban = await banService.isBanned(deviceId, req.ipHash);
    if (!ban) {
      return res.json({ isBanned: false });
    }
    return res.json({ isBanned: true, reason: ban.reason, expiresAt: ban.expires_at });
  } catch (err) {
    logger.error('POST /api/ban-check error', err);
    return res.status(500).json({ error: 'Ban kontrolü yapılamadı' });
  }
});

module.exports = router;
