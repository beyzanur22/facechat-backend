const config = require('../config');

const STUN = { urls: 'stun:stun.l.google.com:19302' };

/**
 * İstemciye gönderilecek ICE sunucu listesi: her zaman STUN, TURN yapılandırıldıysa onu da ekler.
 * WebRTC önce STUN ile doğrudan bağlanmayı dener, olmazsa TURN'e düşer.
 */
function getIceServers() {
  const servers = [STUN];
  if (config.turnUrls.length && config.turnUsername && config.turnCredential) {
    servers.push({
      urls: config.turnUrls,
      username: config.turnUsername,
      credential: config.turnCredential,
    });
  }
  return servers;
}

module.exports = { getIceServers };
