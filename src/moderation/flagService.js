const moderationClient = require('./moderationClient');
const banService = require('./../services/banService');
const logger = require('../utils/logger');

/**
 * Şüpheli bir kareyi değerlendirir; eşik aşılırsa otomatik ban tetikler.
 * Dönüş: { flagged: bool, forceDisconnect: bool }
 */
async function evaluateFrame({ deviceId, ipHash, sessionId, imageBuffer }) {
  const result = await moderationClient.detect(imageBuffer);

  if (!result.flagged) {
    return { flagged: false, forceDisconnect: false };
  }

  logger.warn('flagService: içerik flag edildi', { deviceId, sessionId, categories: result.categories });
  await banService.autoban(deviceId, ipHash, `moderation_flag:${result.categories.join(',')}`);

  return { flagged: true, forceDisconnect: true };
}

module.exports = { evaluateFrame };
