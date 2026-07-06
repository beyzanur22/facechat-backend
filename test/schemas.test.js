const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateJoinQueue,
  normalizeReason,
  validateAdminBan,
  validateSdpRelay,
  validateIceCandidateRelay,
} = require('../src/validation/schemas');

test('validateJoinQueue geçerli payload kabul eder', () => {
  const r = validateJoinQueue({
    deviceId: 'abc-123',
    nickname: 'Ali',
    gender: 'male',
    region: 'TR',
    filterGender: 'any',
    filterRegion: 'any',
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.deviceId, 'abc-123');
});

test('validateJoinQueue deviceId eksikse reddeder', () => {
  const r = validateJoinQueue({ nickname: 'Ali' });
  assert.equal(r.ok, false);
});

test('validateJoinQueue bilinmeyen gender/filtre değerlerini güvenli varsayılana düşürür', () => {
  const r = validateJoinQueue({ deviceId: 'x', gender: 'sirlgnaidsa', filterGender: 'weird' });
  assert.equal(r.ok, true);
  assert.equal(r.value.gender, 'unknown');
  assert.equal(r.value.filterGender, 'any');
});

test('normalizeReason whitelist dışını "other"a düşürür', () => {
  assert.equal(normalizeReason('nudity'), 'nudity');
  assert.equal(normalizeReason('<script>alert(1)</script>'), 'other');
  assert.equal(normalizeReason(123), 'unspecified');
});

test('validateAdminBan geçerli durationMinutes kabul eder', () => {
  const r = validateAdminBan({ deviceId: 'd1', reason: 'spam', durationMinutes: 60 });
  assert.equal(r.ok, true);
  assert.equal(r.value.durationMinutes, 60);
});

test('validateAdminBan string durationMinutes NaN yerine 400 ile reddedilir', () => {
  const r = validateAdminBan({ deviceId: 'd1', durationMinutes: 'abc' });
  assert.equal(r.ok, false);
});

test('validateAdminBan durationMinutes olmadan (süresiz ban) kabul eder', () => {
  const r = validateAdminBan({ deviceId: 'd1', reason: 'kalıcı' });
  assert.equal(r.ok, true);
  assert.equal(r.value.durationMinutes, undefined);
});

test('validateAdminBan deviceId eksikse reddeder', () => {
  const r = validateAdminBan({ durationMinutes: 10 });
  assert.equal(r.ok, false);
});

test('validateSdpRelay geçerli offer/answer kabul eder', () => {
  const r = validateSdpRelay({ sessionId: 's1', sdp: { type: 'offer', sdp: 'v=0...' } });
  assert.equal(r.ok, true);
});

test('validateSdpRelay aşırı büyük sdp\'yi reddeder', () => {
  const r = validateSdpRelay({ sessionId: 's1', sdp: { type: 'offer', sdp: 'x'.repeat(30000) } });
  assert.equal(r.ok, false);
});

test('validateSdpRelay geçersiz type\'ı reddeder', () => {
  const r = validateSdpRelay({ sessionId: 's1', sdp: { type: 'pranswer', sdp: 'x' } });
  assert.equal(r.ok, false);
});

test('validateIceCandidateRelay geçerli candidate kabul eder', () => {
  const r = validateIceCandidateRelay({
    sessionId: 's1',
    candidate: { sdpMid: '0', sdpMLineIndex: 0, candidate: 'candidate:1 1 UDP...' },
  });
  assert.equal(r.ok, true);
});

test('validateIceCandidateRelay aşırı uzun candidate string\'ini reddeder', () => {
  const r = validateIceCandidateRelay({
    sessionId: 's1',
    candidate: { sdpMid: '0', sdpMLineIndex: 0, candidate: 'x'.repeat(5000) },
  });
  assert.equal(r.ok, false);
});
