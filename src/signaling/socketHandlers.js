const queue = require('../matchmaking/queue');
const rooms = require('../matchmaking/room');
const matchmaker = require('../matchmaking/matchmaker');
const banService = require('../services/banService');
const blockService = require('../services/blockService');
const reportService = require('../services/reportService');
const logger = require('../utils/logger');
const { getIceServers } = require('../webrtc/iceServers');
const { clientIpFromSocket, hashIp } = require('../utils/ip');
const reportTokenService = require('../services/reportTokenService');
const velocityService = require('../services/velocityService');
const { createRateLimiter } = require('./rateLimit');
const { validateJoinQueue, validateSdpRelay, validateIceCandidateRelay } = require('../validation/schemas');
const metrics = require('../observability/metrics');
const sentry = require('../observability/sentry');
const connectionLimiter = require('./connectionLimiter');

// Per-socket, per-event rate limitleri (spam/flood koruması).
const EVENT_LIMITS = {
  'join-queue': { windowMs: 10000, max: 30 },
  offer: { windowMs: 10000, max: 30 },
  answer: { windowMs: 10000, max: 30 },
  'ice-candidate': { windowMs: 10000, max: 300 }, // ICE adayları çok olabilir
  skip: { windowMs: 10000, max: 30 },
  leave: { windowMs: 10000, max: 20 },
  report: { windowMs: 60000, max: 10 },
  block: { windowMs: 60000, max: 10 },
  default: { windowMs: 10000, max: 60 },
};

function getClientIpHash(socket) {
  // Gerçek istemci IP'sinin tuzlu hash'i (REST tarafıyla AYNI fonksiyon → ban tutarlı).
  return hashIp(clientIpFromSocket(socket));
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info('socket connected', socket.id);
    metrics.socketConnectionsTotal.inc();

    const allow = createRateLimiter(EVENT_LIMITS);
    const limited = (event, notify) => {
      if (allow(event)) return false;
      if (notify) socket.emit('error', { message: 'Çok fazla istek, lütfen yavaşlayın' });
      return true;
    };

    socket.on('join-queue', async (payload) => {
      try {
        if (limited('join-queue', true)) return;

        const parsed = validateJoinQueue(payload);
        if (!parsed.ok) {
          socket.emit('error', { message: parsed.error });
          return;
        }
        const { deviceId, nickname, gender, region, filterGender, filterRegion } = parsed.value;

        // Cihaz bazlı hız limiti (yeniden bağlanarak per-socket limiti aşmayı önler).
        if (!(await velocityService.hit(deviceId, 'join', 60, 100))) {
          socket.emit('error', { message: 'Bu cihazdan çok fazla istek, lütfen bekleyin' });
          return;
        }

        const ipHash = getClientIpHash(socket);
        const ban = await banService.isBanned(deviceId, ipHash);
        if (ban) {
          socket.emit('banned', { reason: ban.reason, expiresAt: ban.expires_at });
          return;
        }

        // Aynı cihazın eski/hayalet bağlantılarını temizle.
        await cleanupStalePresence(io, deviceId, socket.id);

        const entry = { socketId: socket.id, deviceId, nickname, gender, region, filterGender, filterRegion };
        const result = await matchmaker.joinQueue(entry, (a, b) => blockService.isPairBlocked(a, b));

        if (!result) {
          socket.emit('waiting', {});
          return;
        }

        const { match, room } = result;
        const iceServers = getIceServers();
        // Her katılımcıya, SADECE eşleştiği kişiyi report/block etmeye yetkili kısa ömürlü token.
        const tokenForEntry = await reportTokenService.issue(room.sessionId, entry.deviceId, match.deviceId);
        const tokenForMatch = await reportTokenService.issue(room.sessionId, match.deviceId, entry.deviceId);

        io.to(entry.socketId).emit('match-found', {
          sessionId: room.sessionId,
          isOfferer: true,
          iceServers,
          reportToken: tokenForEntry,
          peerNickname: match.nickname || 'Gizemli Üye',
          peerGender: match.gender || 'unknown',
          peerRegion: match.region || 'TR',
        });
        io.to(match.socketId).emit('match-found', {
          sessionId: room.sessionId,
          isOfferer: false,
          iceServers,
          reportToken: tokenForMatch,
          peerNickname: entry.nickname || 'Gizemli Üye',
          peerGender: entry.gender || 'unknown',
          peerRegion: entry.region || 'TR',
        });
      } catch (err) {
        logger.error('join-queue error', err);
        sentry.captureException(err);
        socket.emit('error', { message: 'join-queue işlenemedi' });
      }
    });

    socket.on('offer', async (payload) => {
      if (limited('offer', false)) return;
      const parsed = validateSdpRelay(payload);
      if (!parsed.ok) return;
      const { sessionId, sdp } = parsed.value;
      const targetSocketId = await rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('offer', { sessionId, sdp });
    });

    socket.on('answer', async (payload) => {
      if (limited('answer', false)) return;
      const parsed = validateSdpRelay(payload);
      if (!parsed.ok) return;
      const { sessionId, sdp } = parsed.value;
      const targetSocketId = await rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('answer', { sessionId, sdp });
    });

    socket.on('ice-candidate', async (payload) => {
      if (limited('ice-candidate', false)) return;
      const parsed = validateIceCandidateRelay(payload);
      if (!parsed.ok) return;
      const { sessionId, candidate } = parsed.value;
      const targetSocketId = await rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('ice-candidate', { sessionId, candidate });
    });

    socket.on('skip', async ({ sessionId }) => {
      if (limited('skip', false)) return;
      await endSession(io, sessionId, socket.id, 'skip');
    });

    socket.on('leave', async ({ sessionId }) => {
      if (limited('leave', false)) return;
      await queue.remove(socket.id);
      if (sessionId) await endSession(io, sessionId, socket.id, 'leave');
    });

    socket.on('block', async ({ sessionId }) => {
      if (limited('block', true)) return;
      try {
        const room = await rooms.getBySessionId(sessionId);
        if (!room) return;

        const isCallerA = room.socketIdA === socket.id;
        const blockerDeviceId = isCallerA ? room.deviceIdA : room.deviceIdB;
        const blockedDeviceId = isCallerA ? room.deviceIdB : room.deviceIdA;

        await blockService.addBlock(blockerDeviceId, blockedDeviceId);

        io.to(room.socketIdA).emit('peer-left', { sessionId, reason: 'block' });
        io.to(room.socketIdB).emit('peer-left', { sessionId, reason: 'block' });
        await rooms.end(sessionId);
      } catch (err) {
        logger.error('block error', err);
        sentry.captureException(err);
      }
    });

    socket.on('report', async ({ sessionId, reason }) => {
      if (limited('report', true)) return;
      try {
        const room = await rooms.getBySessionId(sessionId);
        if (!room) return;

        const isCallerA = room.socketIdA === socket.id;
        const reporterDeviceId = isCallerA ? room.deviceIdA : room.deviceIdB;
        const reportedDeviceId = isCallerA ? room.deviceIdB : room.deviceIdA;

        const { banResult } = await reportService.fileReport({
          reporterDeviceId,
          reportedDeviceId,
          sessionId,
          reason,
        });

        io.to(room.socketIdA).emit('force-disconnect', { sessionId, reason: 'report' });
        io.to(room.socketIdB).emit('force-disconnect', { sessionId, reason: 'report' });
        await rooms.end(sessionId);

        if (banResult) {
          logger.info('report eşiği aşıldı, otomatik ban uygulandı', { reportedDeviceId, banResult });
        }
      } catch (err) {
        logger.error('report error', err);
        sentry.captureException(err);
      }
    });

    socket.on('disconnect', async () => {
      await connectionLimiter.release(socket);
      await queue.remove(socket.id);
      const room = await rooms.getBySocketId(socket.id);
      if (room) await endSession(io, room.sessionId, socket.id, 'disconnect');
      logger.info('socket disconnected', socket.id);
    });
  });
}

/**
 * Aynı deviceId'ye ait eski kuyruk kaydı veya aktif oturumu temizler.
 * Kullanıcı yeniden bağlanınca kendi ölü kopyasıyla eşleşmez.
 */
async function cleanupStalePresence(io, deviceId, currentSocketId) {
  const removedFromQueue = await queue.removeByDeviceId(deviceId, currentSocketId);
  removedFromQueue.forEach((sid) => io.to(sid).emit('force-disconnect', { reason: 'reconnect' }));

  const room = await rooms.getByDeviceId(deviceId);
  if (!room) return;

  const staleSocketId = room.deviceIdA === deviceId ? room.socketIdA : room.socketIdB;
  if (staleSocketId === currentSocketId) return;

  const otherSocketId = await rooms.otherSocketId(room.sessionId, staleSocketId);
  if (otherSocketId) {
    io.to(otherSocketId).emit('peer-left', { sessionId: room.sessionId, reason: 'reconnect' });
  }
  io.to(staleSocketId).emit('force-disconnect', { sessionId: room.sessionId, reason: 'reconnect' });
  await rooms.end(room.sessionId);
}

async function endSession(io, sessionId, requesterSocketId, reasonEvent) {
  const room = await rooms.getBySessionId(sessionId);
  if (!room) return;

  const otherSocketId = await rooms.otherSocketId(sessionId, requesterSocketId);
  if (otherSocketId) {
    io.to(otherSocketId).emit('peer-left', { sessionId, reason: reasonEvent });
  }
  await rooms.end(sessionId);
}

module.exports = { registerSocketHandlers };
