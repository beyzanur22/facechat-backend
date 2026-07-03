const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const logger = require('./utils/logger');
const ipHash = require('./rest/middleware/ipHash');
const apiRateLimiter = require('./rest/middleware/rateLimiter');
const { registerSocketHandlers } = require('./signaling/socketHandlers');

const reportRoutes = require('./rest/routes/report');
const blockRoutes = require('./rest/routes/block');
const banCheckRoutes = require('./rest/routes/ban-check');
const iceConfigRoutes = require('./rest/routes/ice-config');
const moderationFlagRoutes = require('./rest/routes/moderation-flag');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(ipHash);
app.use('/api', apiRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/report', reportRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/ban-check', banCheckRoutes);
app.use('/api/ice-config', iceConfigRoutes);
app.use('/api/moderation-flag', moderationFlagRoutes);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  // Ölü bağlantıları hızlı tespit et (hayalet kuyruk kayıtlarını azaltır).
  pingInterval: 10000,
  pingTimeout: 8000,
});

registerSocketHandlers(io);

httpServer.listen(config.port, () => {
  logger.info(`facechat-backend dinlemede: http://localhost:${config.port}`);
});
