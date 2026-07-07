const config = require('../config');
const logger = require('../utils/logger');
const sentry = require('../observability/sentry');

/**
 * Sağlayıcıdan bağımsız arayüz: detect(imageBuffer) -> { flagged, categories, confidence }
 * - provider 'none'      : analiz yapılmaz (fail-open) — varsayılan.
 * - provider 'sightengine': Sightengine nudity + gore modelleri ile gerçek analiz.
 */

// Eşik: bu değerin üzerindeki olasılık "flag" sayılır. Env ile ayarlanabilir.
const THRESHOLD = Number(process.env.MODERATION_THRESHOLD) || 0.6;
const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json';

async function detectSightengine(imageBuffer) {
  if (!config.moderationApiUser || !config.moderationApiKey) {
    logger.warn('moderationClient: sightengine seçili ama API kimliği eksik — fail-open');
    return { flagged: false, categories: [], confidence: 0 };
  }

  const form = new FormData();
  form.append('media', new Blob([imageBuffer]), 'frame.jpg');
  form.append('models', 'nudity-2.1,gore-2.0');
  form.append('api_user', config.moderationApiUser);
  form.append('api_secret', config.moderationApiKey);

  const res = await fetch(SIGHTENGINE_URL, { method: 'POST', body: form });
  if (!res.ok) {
    // Sağlayıcı hatası meşru kullanıcıyı yanlışlıkla banlamasın → fail-open + izle.
    const body = await res.text().catch(() => '');
    const err = new Error(`sightengine HTTP ${res.status}: ${body.slice(0, 200)}`);
    logger.error('moderationClient: sightengine hatası', err);
    sentry.captureException(err);
    return { flagged: false, categories: [], confidence: 0 };
  }

  const data = await res.json();
  const n = data.nudity || {};
  const gore = data.gore || {};

  // nudity-2.1: açık kategoriler. gore-2.0: prob.
  const nudityScore = Math.max(n.sexual_activity || 0, n.sexual_display || 0, n.erotica || 0);
  const goreScore = gore.prob || 0;

  const categories = [];
  if (nudityScore >= THRESHOLD) categories.push('nudity');
  if (goreScore >= THRESHOLD) categories.push('gore');

  return {
    flagged: categories.length > 0,
    categories,
    confidence: Math.max(nudityScore, goreScore),
  };
}

async function detect(imageBuffer) {
  if (config.moderationProvider === 'none') {
    logger.debug('moderationClient: provider "none", frame analiz edilmeden geçildi');
    return { flagged: false, categories: [], confidence: 0 };
  }

  if (config.moderationProvider === 'sightengine') {
    try {
      return await detectSightengine(imageBuffer);
    } catch (err) {
      logger.error('moderationClient: sightengine beklenmedik hata', err);
      sentry.captureException(err);
      return { flagged: false, categories: [], confidence: 0 }; // fail-open
    }
  }

  throw new Error(`Desteklenmeyen moderation provider: ${config.moderationProvider}`);
}

module.exports = { detect };
