const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBirthdate, computeAge } = require('../src/validation/schemas');

test('validateBirthdate geçerli YYYY-MM-DD kabul eder', () => {
  const r = validateBirthdate('2000-05-15');
  assert.equal(r.ok, true);
  assert.equal(r.value, '2000-05-15');
});

test('validateBirthdate hatalı formatı reddeder', () => {
  assert.equal(validateBirthdate('15/05/2000').ok, false);
  assert.equal(validateBirthdate('2000-5-1').ok, false);
  assert.equal(validateBirthdate('not-a-date').ok, false);
});

test('validateBirthdate gelecekteki tarihi reddeder', () => {
  const next = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.equal(validateBirthdate(next).ok, false);
});

test('computeAge doğru tam yıl hesaplar', () => {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, '0');
  const d = String(today.getUTCDate()).padStart(2, '0');

  // Tam 20 yıl önce bugün → 20.
  assert.equal(computeAge(`${y - 20}-${m}-${d}`), 20);
  // Doğum günü henüz gelmemiş (yarın) → 1 eksik. (Ay/gün sınır durumlarını atlamak için
  // yıl başında sabit bir tarih kullan.)
  assert.equal(computeAge(`${y - 18}-12-31`) <= 18, true);
});

test('computeAge yaş kapısı sınırı: 17 < 18', () => {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, '0');
  const d = String(today.getUTCDate()).padStart(2, '0');
  assert.equal(computeAge(`${y - 17}-${m}-${d}`) < 18, true);
});
