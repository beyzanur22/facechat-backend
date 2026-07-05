const express = require('express');
const userService = require('../../services/userService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * DELETE /api/user
 * Body: { deviceId }
 * KVKK "hesabımı sil": hard delete DEĞİL — userService.softDeleteUser kişisel alanları
 * (email/isim/google bağlantısı) temizler, device_id + ban/report geçmişi kalır.
 */
router.delete('/', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  try {
    await userService.softDeleteUser(deviceId);
    return res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /api/user error', err);
    return res.status(500).json({ error: 'Hesap silinemedi' });
  }
});

module.exports = router;
