const crypto = require('crypto');
const config = require('../../config');

/** token === config.adminToken'ı zaman sabit şekilde karşılaştırır (timing attack'e kapalı). */
function tokensMatch(token, expected) {
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Uzunluk farklıysa bile aynı sürede dönmek için yine de bir karşılaştırma yap.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/** Admin route'larını korur. adminToken tanımlı değilse HER şey reddedilir (fail-closed). */
function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!config.adminToken || !tokensMatch(token, config.adminToken)) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  next();
}

module.exports = adminAuth;
