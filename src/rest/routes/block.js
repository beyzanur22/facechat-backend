const express = require('express');
const blockService = require('../../services/blockService');
const logger = require('../../utils/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const { blockerDeviceId, blockedDeviceId } = req.body || {};

  if (!blockerDeviceId || !blockedDeviceId) {
    return res.status(400).json({ error: 'blockerDeviceId ve blockedDeviceId zorunlu' });
  }

  try {
    await blockService.addBlock(blockerDeviceId, blockedDeviceId);
    return res.json({ ok: true });
  } catch (err) {
    logger.error('POST /api/block error', err);
    return res.status(500).json({ error: 'Block kaydedilemedi' });
  }
});

module.exports = router;
