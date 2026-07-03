const express = require('express');

const router = express.Router();

// Faz 2/4'te TURN credential'ları (coturn use-auth-secret) buraya eklenecek.
// Android tarafı bu listeyi match-found payload'ından aldığı için kod değişikliği gerekmez.
router.get('/', (_req, res) => {
  res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
});

module.exports = router;
