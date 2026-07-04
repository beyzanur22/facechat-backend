const express = require('express');
const supabaseAuth = require('../../auth/supabaseAuth');
const userService = require('../../services/userService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/sync
 * Body: { deviceId }   Header: Authorization: Bearer <supabase access token>
 * Google ile giriş yapan istemci çağırır: token'ı doğrular, hesabı deviceId'ye bağlar, premium döner.
 */
router.post('/sync', async (req, res) => {
  const { deviceId } = req.body || {};
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  if (!token) return res.status(401).json({ error: 'Authorization Bearer token zorunlu' });

  try {
    const identity = await supabaseAuth.verifyAccessToken(token);
    const user = await userService.linkAccount(deviceId, identity);
    const isPremium = await userService.getPremium(deviceId);
    return res.json({
      linked: true,
      email: user.email,
      displayName: user.display_name,
      isPremium,
    });
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    logger.error('POST /api/auth/sync error', err);
    return res.status(500).json({ error: 'Giriş senkronizasyonu yapılamadı' });
  }
});

/**
 * GET /api/auth/status?deviceId=...
 * Misafir dahil premium durumunu okur (giriş gerektirmez).
 */
router.get('/status', async (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId zorunlu' });
  try {
    const isPremium = await userService.getPremium(deviceId);
    return res.json({ isPremium });
  } catch (err) {
    logger.error('GET /api/auth/status error', err);
    return res.status(500).json({ error: 'Durum okunamadı' });
  }
});

module.exports = router;
