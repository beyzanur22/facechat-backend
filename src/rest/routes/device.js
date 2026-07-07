const express = require('express');
const userService = require('../../services/userService');
const config = require('../../config');
const { validateBirthdate, computeAge } = require('../../validation/schemas');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/device/register
 * Body: { deviceId, birthdate? }   (birthdate: "YYYY-MM-DD")
 * İstemci deviceId'yi ilk ürettiğinde bir kez çağırır. Dönen deviceSecret cihazda
 * güvenli şekilde saklanmalı (EncryptedSharedPreferences) — hesap silme, premium redeem
 * ve auth/status gibi hassas uçlar bunu Authorization: Bearer olarak ister.
 * Secret SADECE bu ilk (claim) çağrısında döner, sonrasında bir daha verilmez.
 *
 * Yaş kapısı: birthdate verilirse ve MIN_AGE (>0) altındaysa 403 ile reddedilir; aksi
 * halde doğum tarihi write-once olarak saklanır.
 */
router.post('/register', async (req, res) => {
  const { deviceId, birthdate } = req.body || {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
    return res.status(400).json({ error: 'geçerli bir deviceId zorunlu' });
  }

  let validBirthdate = null;
  if (birthdate !== undefined && birthdate !== null && birthdate !== '') {
    const parsed = validateBirthdate(birthdate);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    validBirthdate = parsed.value;
    if (config.minAge > 0 && computeAge(validBirthdate) < config.minAge) {
      return res.status(403).json({ error: 'under_age', minAge: config.minAge });
    }
  }

  try {
    const result = await userService.registerDevice(deviceId, validBirthdate);
    return res.json({ ok: true, ...(result.claimed ? { deviceSecret: result.deviceSecret } : {}) });
  } catch (err) {
    logger.error('POST /api/device/register error', err);
    return res.status(500).json({ error: 'Cihaz kaydedilemedi' });
  }
});

module.exports = router;
