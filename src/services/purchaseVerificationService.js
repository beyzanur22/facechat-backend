const config = require('../config');
const logger = require('../utils/logger');

/**
 * Sağlayıcıdan bağımsız arayüz: verify({ provider, productId, purchaseToken }) -> { valid, expiresAt }
 * Play Console/App Store Connect servis hesabı henüz kurulmadı — bağlanana kadar hiçbir
 * makbuz "valid: true" dönmez (sahte satın alma kabul edilmesin diye fail-closed).
 */
async function verify({ provider }) {
  if (provider === 'google_play') {
    if (!config.googlePlayServiceAccountJson) {
      logger.warn('purchaseVerificationService: Google Play servis hesabı tanımlı değil, doğrulama reddedildi');
      return { valid: false, expiresAt: null };
    }
    throw new Error('Google Play doğrulaması henüz uygulanmadı');
  }

  if (provider === 'app_store') {
    throw new Error('App Store doğrulaması henüz uygulanmadı');
  }

  if (provider === 'stripe') {
    throw new Error('Stripe doğrulaması henüz uygulanmadı');
  }

  logger.warn(`purchaseVerificationService: desteklenmeyen provider "${provider}"`);
  return { valid: false, expiresAt: null };
}

module.exports = { verify };
