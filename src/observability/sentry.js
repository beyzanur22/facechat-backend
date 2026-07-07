const Sentry = require('@sentry/node');
const config = require('../config');
const logger = require('../utils/logger');

// Env-gated: SENTRY_DSN boşsa tüm fonksiyonlar no-op (mevcut fail-open desenine uygun).
// Böylece Sentry hesabı olmadan da uygulama sorunsuz çalışır; DSN girilince otomatik aktif olur.
let enabled = false;

function init() {
  if (!config.sentryDsn) {
    logger.info('[sentry] SENTRY_DSN yok — hata izleme devre dışı');
    return;
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    // Sadece hata izleme; performans tracing kapalı (maliyet/gürültü olmasın).
    tracesSampleRate: 0,
    release: config.release || undefined,
  });
  enabled = true;
  logger.info('[sentry] hata izleme aktif');
}

function captureException(err, extra) {
  if (!enabled) return;
  try {
    Sentry.captureException(err, extra ? { extra } : undefined);
  } catch (e) {
    logger.error('[sentry] captureException hatası', e);
  }
}

module.exports = { init, captureException, isEnabled: () => enabled };
