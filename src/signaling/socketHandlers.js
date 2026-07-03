const queue = require('../matchmaking/queue');
const matcher = require('../matchmaking/matcher');
const rooms = require('../matchmaking/room');
const banService = require('../services/banService');
const blockService = require('../services/blockService');
const reportService = require('../services/reportService');
const logger = require('../utils/logger');

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function getClientIpHash(socket) {
  // MVP: ham IP'nin kendisini "hash" olarak kullanmıyoruz, basit bir ayraç yeterli.
  // Gerçek üretimde crypto.createHash('sha256') ile tuzlanmalı.
  return socket.handshake.address || null;
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info('socket connected', socket.id);

    socket.on('join-queue', async (payload) => {
      try {
        const { deviceId, gender, region, filterGender, filterRegion } = payload || {};
        if (!deviceId) {
          socket.emit('error', { message: 'deviceId zorunlu' });
          return;
        }

        const ipHash = getClientIpHash(socket);
        const ban = await banService.isBanned(deviceId, ipHash);
        if (ban) {
          socket.emit('banned', { reason: ban.reason, expiresAt: ban.expires_at });
          return;
        }

        // Aynı cihazın eski/hayalet bağlantılarını temizle (yeniden bağlanma / uygulama yeniden başlatma).
        cleanupStalePresence(io, deviceId, socket.id);

        const entry = { socketId: socket.id, deviceId, gender, region, filterGender, filterRegion };

        const match = await matcher.findMatch(entry, (a, b) => blockService.isPairBlocked(a, b));

        if (!match) {
          queue.add(entry);
          socket.emit('waiting', {});
          return;
        }

        queue.remove(match.socketId);
        const room = rooms.create(entry, match);

        io.to(entry.socketId).emit('match-found', {
          sessionId: room.sessionId,
          isOfferer: true,
          iceServers: DEFAULT_ICE_SERVERS,
        });
        io.to(match.socketId).emit('match-found', {
          sessionId: room.sessionId,
          isOfferer: false,
          iceServers: DEFAULT_ICE_SERVERS,
        });
      } catch (err) {
        logger.error('join-queue error', err);
        socket.emit('error', { message: 'join-queue işlenemedi' });
      }
    });

    socket.on('offer', ({ sessionId, sdp }) => {
      const targetSocketId = rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('offer', { sessionId, sdp });
    });

    socket.on('answer', ({ sessionId, sdp }) => {
      const targetSocketId = rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('answer', { sessionId, sdp });
    });

    socket.on('ice-candidate', ({ sessionId, candidate }) => {
      const targetSocketId = rooms.otherSocketId(sessionId, socket.id);
      if (targetSocketId) io.to(targetSocketId).emit('ice-candidate', { sessionId, candidate });
    });

    socket.on('skip', ({ sessionId }) => {
      endSession(io, sessionId, socket.id, 'skip');
    });

    socket.on('leave', ({ sessionId }) => {
      queue.remove(socket.id);
      if (sessionId) endSession(io, sessionId, socket.id, 'leave');
    });

    socket.on('block', async ({ sessionId }) => {
      try {
        const room = rooms.getBySessionId(sessionId);
        if (!room) return;

        const isCallerA = room.socketIdA === socket.id;
        const blockerDeviceId = isCallerA ? room.deviceIdA : room.deviceIdB;
        const blockedDeviceId = isCallerA ? room.deviceIdB : room.deviceIdA;

        await blockService.addBlock(blockerDeviceId, blockedDeviceId);

        io.to(room.socketIdA).emit('peer-left', { sessionId, reason: 'block' });
        io.to(room.socketIdB).emit('peer-left', { sessionId, reason: 'block' });
        rooms.end(sessionId);
      } catch (err) {
        logger.error('block error', err);
      }
    });

    socket.on('report', async ({ sessionId, reason }) => {
      try {
        const room = rooms.getBySessionId(sessionId);
        if (!room) return;

        const isCallerA = room.socketIdA === socket.id;
        const reporterDeviceId = isCallerA ? room.deviceIdA : room.deviceIdB;
        const reportedDeviceId = isCallerA ? room.deviceIdB : room.deviceIdA;

        const { banResult } = await reportService.fileReport({
          reporterDeviceId,
          reportedDeviceId,
          sessionId,
          reason: reason || 'unspecified',
        });

        io.to(room.socketIdA).emit('force-disconnect', { sessionId, reason: 'report' });
        io.to(room.socketIdB).emit('force-disconnect', { sessionId, reason: 'report' });
        rooms.end(sessionId);

        if (banResult) {
          logger.info('report eşiği aşıldı, otomatik ban uygulandı', { reportedDeviceId, banResult });
        }
      } catch (err) {
        logger.error('report error', err);
      }
    });

    socket.on('disconnect', () => {
      queue.remove(socket.id);
      const room = rooms.getBySocketId(socket.id);
      if (room) endSession(io, room.sessionId, socket.id, 'disconnect');
      logger.info('socket disconnected', socket.id);
    });
  });
}

/**
 * Aynı deviceId'ye ait eski kuyruk kaydı veya aktif oturumu temizler.
 * Hayalet bağlantı bug'ının kalıcı çözümü: kullanıcı yeniden bağlanınca kendi ölü kopyasıyla eşleşmez.
 */
function cleanupStalePresence(io, deviceId, currentSocketId) {
  const removedFromQueue = queue.removeByDeviceId(deviceId, currentSocketId);
  removedFromQueue.forEach((sid) => io.to(sid).emit('force-disconnect', { reason: 'reconnect' }));

  const room = rooms.getByDeviceId(deviceId);
  if (!room) return;

  const staleSocketId = room.deviceIdA === deviceId ? room.socketIdA : room.socketIdB;
  if (staleSocketId === currentSocketId) return;

  const otherSocketId = rooms.otherSocketId(room.sessionId, staleSocketId);
  if (otherSocketId) {
    io.to(otherSocketId).emit('peer-left', { sessionId: room.sessionId, reason: 'reconnect' });
  }
  io.to(staleSocketId).emit('force-disconnect', { sessionId: room.sessionId, reason: 'reconnect' });
  rooms.end(room.sessionId);
}

function endSession(io, sessionId, requesterSocketId, reasonEvent) {
  const room = rooms.getBySessionId(sessionId);
  if (!room) return;

  const otherSocketId = rooms.otherSocketId(sessionId, requesterSocketId);
  if (otherSocketId) {
    io.to(otherSocketId).emit('peer-left', { sessionId, reason: reasonEvent });
  }
  rooms.end(sessionId);
}

module.exports = { registerSocketHandlers };
