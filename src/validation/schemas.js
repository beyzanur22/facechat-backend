const { z } = require('zod');

// join-queue payload'ı — güvenilmeyen istemci girdisi. Enum + uzunluk sınırları.
const joinQueueSchema = z.object({
  deviceId: z.string().min(1).max(128),
  nickname: z.string().max(32).nullish(),
  gender: z.enum(['male', 'female', 'unknown']).catch('unknown'),
  region: z.string().max(8).catch('unknown'),
  filterGender: z.enum(['male', 'female', 'any']).catch('any'),
  filterRegion: z.string().max(8).catch('any'),
});

function validateJoinQueue(payload) {
  const r = joinQueueSchema.safeParse(payload || {});
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues[0]?.message || 'geçersiz veri' };
}

// Şikayet nedeni whitelist'i — DB'ye ham/serbest string yazılmasın.
const REPORT_REASONS = ['nudity', 'harassment', 'spam', 'minor', 'violence', 'other', 'unspecified'];
function normalizeReason(reason) {
  if (typeof reason !== 'string') return 'unspecified';
  const r = reason.trim().toLowerCase().slice(0, 32);
  return REPORT_REASONS.includes(r) ? r : 'other';
}

// Admin manuel ban payload'ı — durationMinutes tipsiz geçilirse (ör. string) NaN'a
// düşüp Date(NaN).toISOString() ile 500 patlamasın diye burada sıkı doğrulanır.
const adminBanSchema = z.object({
  deviceId: z.string().min(1).max(128),
  reason: z.string().max(200).nullish(),
  durationMinutes: z.coerce.number().int().positive().max(60 * 24 * 365).nullish(),
});

function validateAdminBan(payload) {
  const r = adminBanSchema.safeParse(payload || {});
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues[0]?.message || 'geçersiz veri' };
}

// WebRTC sinyalizasyon relay payload'ları — sunucu bunları körlemesine karşı tarafa iletir,
// bu yüzden tip/boyut sınırı olmadan bozuk/kötü niyetli bir client relay'i istismar edebilir.
const sdpRelaySchema = z.object({
  sessionId: z.string().min(1).max(128),
  sdp: z.object({
    type: z.enum(['offer', 'answer']),
    sdp: z.string().min(1).max(20000),
  }),
});

const iceCandidateRelaySchema = z.object({
  sessionId: z.string().min(1).max(128),
  candidate: z.object({
    sdpMid: z.string().max(64).nullish(),
    sdpMLineIndex: z.number().int().min(0).max(100),
    candidate: z.string().max(2000),
  }),
});

function validateSdpRelay(payload) {
  const r = sdpRelaySchema.safeParse(payload || {});
  return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues[0]?.message || 'geçersiz veri' };
}

function validateIceCandidateRelay(payload) {
  const r = iceCandidateRelaySchema.safeParse(payload || {});
  return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.issues[0]?.message || 'geçersiz veri' };
}

module.exports = {
  validateJoinQueue,
  normalizeReason,
  validateAdminBan,
  validateSdpRelay,
  validateIceCandidateRelay,
};
