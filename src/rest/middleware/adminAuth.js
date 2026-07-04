const config = require('../../config');

/** Admin route'larını korur. adminToken tanımlı değilse HER şey reddedilir (fail-closed). */
function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!config.adminToken || token !== config.adminToken) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  next();
}

module.exports = adminAuth;
