const express = require('express');
const flagService = require('../../moderation/flagService');
const logger = require('../../utils/logger');

const router = express.Router();

// body: { deviceId, sessionId, imageBase64 } — Android sadece ML Kit şüphe tespitinde çağırır, her frame'de değil.
router.post('/', async (req, res) => {
  const { deviceId, sessionId, imageBase64 } = req.body || {};
  if (!deviceId || !sessionId || !imageBase64) {
    return res.status(400).json({ error: 'deviceId, sessionId ve imageBase64 zorunlu' });
  }

  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const result = await flagService.evaluateFrame({ deviceId, ipHash: req.ipHash, sessionId, imageBuffer });
    return res.json(result);
  } catch (err) {
    logger.error('POST /api/moderation-flag error', err);
    return res.status(500).json({ error: 'Moderasyon değerlendirmesi yapılamadı' });
  }
});

module.exports = router;
