const express = require('express');
const premiumSubscriptionService = require('../../services/premiumSubscriptionService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/premium/redeem
 * Body: { deviceId, provider, productId, purchaseToken }
 * Android/Web satın alma sonrası makbuzu buraya gönderir; sunucu tarafında doğrulanır.
 * provider: 'google_play' | 'app_store' | 'stripe' (Play/App Store entegrasyonu kurulana
 * kadar doğrulama fail-closed reddeder — bkz. purchaseVerificationService).
 */
router.post('/redeem', async (req, res) => {
  const { deviceId, provider, productId, purchaseToken } = req.body || {};
  if (!deviceId || !provider || !productId || !purchaseToken) {
    return res.status(400).json({ error: 'deviceId, provider, productId, purchaseToken zorunlu' });
  }
  try {
    const result = await premiumSubscriptionService.redeemPurchase({
      deviceId,
      provider,
      productId,
      purchaseToken,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    logger.error('POST /api/premium/redeem error', err);
    return res.status(500).json({ error: 'Satın alma işlenemedi' });
  }
});

module.exports = router;
