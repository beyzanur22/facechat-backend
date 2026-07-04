const express = require('express');
const flagService = require('../../moderation/flagService');
const reportTokenService = require('../../services/reportTokenService');
const velocityService = require('../../services/velocityService');
const logger = require('../../utils/logger');

const router = express.Router();

const MAX_IMAGE_B64 = 1_500_000; // ~1.1MB görsel (base64)

// body: { reportToken, imageBase64 }
// Eşleşmedeki kişinin şüpheli karesini KANITLA bildirir → reportToken doğrulanır (framing/IDOR kapalı).
router.post('/', async (req, res) => {
  const { reportToken, imageBase64 } = req.body || {};
  if (!reportToken || !imageBase64) {
    return res.status(400).json({ error: 'reportToken ve imageBase64 zorunlu' });
  }
  if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_IMAGE_B64) {
    return res.status(413).json({ error: 'Görsel çok büyük' });
  }

  try {
    const ctx = await reportTokenService.verify(reportToken);
    if (!ctx) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş reportToken' });
    }

    // Çağıran cihaz bazlı hız limiti (frame spam koruması).
    if (!(await velocityService.hit(ctx.selfDeviceId, 'modflag', 60, 30))) {
      return res.status(429).json({ error: 'Çok fazla moderasyon isteği' });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const result = await flagService.evaluateFrame({
      deviceId: ctx.peerDeviceId, // şüpheli içerik karşı tarafa ait
      ipHash: req.ipHash,
      sessionId: ctx.sessionId,
      imageBuffer,
    });
    return res.json(result);
  } catch (err) {
    logger.error('POST /api/moderation-flag error', err);
    return res.status(500).json({ error: 'Moderasyon değerlendirmesi yapılamadı' });
  }
});

module.exports = router;
