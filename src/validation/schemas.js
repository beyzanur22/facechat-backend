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

module.exports = { validateJoinQueue, normalizeReason };
