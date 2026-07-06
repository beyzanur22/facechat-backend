const db = require('../../db');
const { verifySecret } = require('../../utils/deviceSecret');

/**
 * Hassas cihaz-bazlı REST çağrılarını korur (hesap silme, premium redeem, auth/status).
 * İstemci POST /api/device/register ile aldığı secret'ı Authorization: Bearer olarak göndermeli.
 * getDeviceId(req): route'a göre deviceId'nin body'den mi query'den mi okunacağını belirler.
 */
function requireDeviceAuth(getDeviceId) {
  return async function deviceAuth(req, res, next) {
    const deviceId = getDeviceId(req);
    const authHeader = req.headers.authorization || '';
    const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!deviceId || !secret) {
      return res.status(401).json({ error: 'Cihaz doğrulaması gerekli (Authorization: Bearer <deviceSecret>)' });
    }

    try {
      const user = await db('users').where({ device_id: deviceId }).first();
      if (!user || !verifySecret(secret, user.device_secret_hash)) {
        return res.status(401).json({ error: 'Geçersiz cihaz doğrulaması' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireDeviceAuth;
