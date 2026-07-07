const pino = require('pino');

// Yapılandırılmış (JSON) loglama. Üretimde makine-okunur JSON (log toplayıcılar/Sentry/Render
// için); geliştirmede pino-pretty ile insan-okunur renkli çıktı.
const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const base = pino({
  level,
  // Error nesnelerini stack ile serialize et (err alanı).
  serializers: { err: pino.stdSerializers.err },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

/**
 * Mevcut çağrı yerleri console tarzı variadic kullanıyor:
 *   logger.info('socket connected', socket.id)
 *   logger.error('join-queue error', err)
 *   logger.warn('flag edildi', { deviceId, categories })
 * Bu adaptör onları pino'nun (mergeObj, msg) imzasına köprüler — string'ler mesaj olur,
 * nesneler/Error'lar structured alan olur. Böylece çağrı yerleri hiç değişmez.
 */
function adapt(lvl) {
  return (...args) => {
    const msgParts = [];
    let merge = null;
    for (const a of args) {
      if (a instanceof Error) {
        merge = merge || {};
        merge.err = a;
      } else if (a && typeof a === 'object') {
        merge = Object.assign(merge || {}, a);
      } else if (a !== undefined) {
        msgParts.push(typeof a === 'string' ? a : String(a));
      }
    }
    const msg = msgParts.join(' ');
    if (merge) base[lvl](merge, msg);
    else base[lvl](msg);
  };
}

module.exports = {
  debug: adapt('debug'),
  info: adapt('info'),
  warn: adapt('warn'),
  error: adapt('error'),
  // Ham pino örneği (ileride child logger / request-id gerekirse).
  raw: base,
};
