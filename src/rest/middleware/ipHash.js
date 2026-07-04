const { clientIpFromExpress, hashIp } = require('../../utils/ip');

/** İstemci IP'sinin tuzlu hash'ini req.ipHash olarak ekler (ham IP saklanmasın). */
function ipHash(req, _res, next) {
  req.ipHash = hashIp(clientIpFromExpress(req));
  next();
}

module.exports = ipHash;
