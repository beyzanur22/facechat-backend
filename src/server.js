const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const logger = require('./utils/logger');
const sentry = require('./observability/sentry');
const metrics = require('./observability/metrics');
const ipHash = require('./rest/middleware/ipHash');
const apiRateLimiter = require('./rest/middleware/rateLimiter');
const adminAuth = require('./rest/middleware/adminAuth');
const { registerSocketHandlers } = require('./signaling/socketHandlers');
const connectionLimiter = require('./signaling/connectionLimiter');
const redis = require('./redis');
const db = require('./db');
const { createAdapter } = require('@socket.io/redis-adapter');

// Hata izlemeyi mümkün olan en erken noktada başlat (env-gated — DSN yoksa no-op).
sentry.init();

const reportRoutes = require('./rest/routes/report');
const blockRoutes = require('./rest/routes/block');
const banCheckRoutes = require('./rest/routes/ban-check');
const iceConfigRoutes = require('./rest/routes/ice-config');
const moderationFlagRoutes = require('./rest/routes/moderation-flag');
const authRoutes = require('./rest/routes/auth');
const adminRoutes = require('./rest/routes/admin');
const userRoutes = require('./rest/routes/user');
const premiumRoutes = require('./rest/routes/premium');
const deviceRoutes = require('./rest/routes/device');

const app = express();
// Render/proxy arkasında gerçek istemci IP'si için (rate-limit + ban tutarlılığı kritik).
app.set('trust proxy', 1);
const corsOptions = config.corsOrigins.length ? { origin: config.corsOrigins } : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(ipHash);
app.use('/api', apiRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Prometheus metrikleri — adminAuth ile korunur (scraper Bearer ADMIN_TOKEN gönderir).
app.get('/metrics', adminAuth, async (_req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    logger.error('GET /metrics error', err);
    res.status(500).end();
  }
});
// Readiness: bağımlılıklar (DB + Redis) sağlıklı mı — LB trafiği buna göre yönlendirir.
app.get('/ready', async (_req, res) => {
  try {
    await db.raw('select 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

app.use('/api/report', reportRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/ban-check', banCheckRoutes);
app.use('/api/ice-config', iceConfigRoutes);
app.use('/api/moderation-flag', moderationFlagRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/device', deviceRoutes);

// Basit moderasyon paneli (statik HTML; API çağrıları ADMIN_TOKEN ister).
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Merkezi hata yakalayıcı — beklenmedik route hatalarında sızıntısız temiz JSON döner.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('unhandled route error:', err);
  sentry.captureException(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: config.corsOrigins.length ? { origin: config.corsOrigins } : { origin: '*' },
  // Ölü bağlantıları hızlı tespit et (hayalet kuyruk kayıtlarını azaltır).
  pingInterval: 10000,
  pingTimeout: 8000,
});

// Socket.io Redis adapter: sunucular çoğaldığında io.to(socketId).emit() örnekler arası çalışır.
const pubClient = redis;
const subClient = redis.duplicate();
subClient.on('error', (err) => logger.error('[redis-adapter] sub hata:', err.message));
io.adapter(createAdapter(pubClient, subClient));

// IP-hash başına eşzamanlı bağlantı limiti (handshake'te reddet).
io.use(connectionLimiter.guard);

registerSocketHandlers(io);

httpServer.listen(config.port, () => {
  logger.info(`facechat-backend dinlemede: http://localhost:${config.port}`);
});

// --- Zarif kapanış & süreç güvenliği ---
function shutdown(signal) {
  logger.info(`${signal} alındı, zarif kapanış başlıyor...`);
  httpServer.close(() => {
    Promise.allSettled([redis.quit(), subClient.quit(), db.destroy()]).then(() => {
      logger.info('Bağlantılar kapandı, çıkılıyor.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000).unref(); // takılırsa zorla çık
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection:', reason);
  sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException:', err);
  sentry.captureException(err);
  process.exit(1);
});
