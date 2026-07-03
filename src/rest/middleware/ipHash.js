const crypto = require('crypto');

/** İstemci IP'sini hashleyip req.ipHash olarak ekler (ban tablosunda ham IP tutulmasın diye). */
function ipHash(req, _res, next) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  req.ipHash = crypto.createHash('sha256').update(ip).digest('hex');
  next();
}

module.exports = ipHash;
