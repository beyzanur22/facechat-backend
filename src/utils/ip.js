const crypto = require('crypto');
const config = require('../config');

/**
 * Gerçek istemci IP'sini ve tuzlu SHA-256 hash'ini tek yerden üretir.
 * Proxy (Render) arkasında X-Forwarded-For'un İLK adresi gerçek istemcidir.
 */
function clientIpFromExpress(req) {
  // app.set('trust proxy', ...) sayesinde req.ip zaten XFF'ten gelir.
  return req.ip || req.socket?.remoteAddress || '';
}

function clientIpFromSocket(socket) {
  const xff = socket.handshake.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return socket.handshake.address || '';
}

/** Ham IP yerine tuzlu hash saklanır (KVKK). Her yerde AYNI fonksiyon → ban tutarlı. */
function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(config.ipHashSalt + ip).digest('hex');
}

module.exports = { clientIpFromExpress, clientIpFromSocket, hashIp };
