const express = require('express');
const { getIceServers } = require('../../webrtc/iceServers');

const router = express.Router();

// İstemci bu listeyi hem buradan hem match-found payload'ından alabilir.
router.get('/', (_req, res) => {
  res.json({ iceServers: getIceServers() });
});

module.exports = router;
