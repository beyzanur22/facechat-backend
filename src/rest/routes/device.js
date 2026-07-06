const express = require('express');
const userService = require('../../services/userService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/device/register
 * Body: { deviceId }
 * İstemci deviceId'yi ilk ürettiğinde bir kez çağırır. Dönen deviceSecret cihazda
 * güvenli şekilde saklanmalı (EncryptedSharedPreferences) — hesap silme, premium redeem
 * ve auth/status gibi hassas uçlar bunu Authorization: Bearer olarak ister.
 * Secret SADECE bu ilk (claim) çağrısında döner, sonrasında bir daha verilmez.
 */
router.post('/register', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
    return res.status(400).json({ error: 'geçerli bir deviceId zorunlu' });
  }
  try {
    const result = await userService.registerDevice(deviceId);
    return res.json({ ok: true, ...(result.claimed ? { deviceSecret: result.deviceSecret } : {}) });
  } catch (err) {
    logger.error('POST /api/device/register error', err);
    return res.status(500).json({ error: 'Cihaz kaydedilemedi' });
  }
});

module.exports = router;
