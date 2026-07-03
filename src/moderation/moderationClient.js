const config = require('../config');
const logger = require('../utils/logger');

/**
 * Sağlayıcıdan bağımsız arayüz: detect(imageBuffer) -> { flagged, categories, confidence }
 * MVP'de provider 'none' — gerçek entegrasyon (Rekognition/Sightengine) faz 3'te eklenecek.
 */
async function detect(imageBuffer) {
  if (config.moderationProvider === 'none') {
    logger.debug('moderationClient: provider "none", frame analiz edilmeden geçildi');
    return { flagged: false, categories: [], confidence: 0 };
  }

  throw new Error(`Desteklenmeyen moderation provider: ${config.moderationProvider}`);
}

module.exports = { detect };
