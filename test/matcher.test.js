const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMutualMatch } = require('../src/matchmaking/matcher');

const mk = (o) => ({ gender: 'unknown', region: 'TR', filterGender: 'any', filterRegion: 'any', ...o });

test('her iki taraf da "any" filtreliyse eşleşir', () => {
  assert.equal(isMutualMatch(mk({}), mk({})), true);
});

test('cinsiyet filtresi tek yönlü uymuyorsa eşleşmez', () => {
  const a = mk({ gender: 'male', filterGender: 'female' }); // A kadın ister
  const b = mk({ gender: 'male', filterGender: 'any' }); // B erkek
  assert.equal(isMutualMatch(a, b), false);
});

test('karşılıklı cinsiyet uyumu varsa eşleşir', () => {
  const a = mk({ gender: 'male', filterGender: 'female' }); // erkek, kadın ister
  const b = mk({ gender: 'female', filterGender: 'male' }); // kadın, erkek ister
  assert.equal(isMutualMatch(a, b), true);
});

test('bölge filtresi uymazsa eşleşmez', () => {
  const a = mk({ region: 'TR', filterRegion: 'TR' });
  const b = mk({ region: 'US', filterRegion: 'any' });
  assert.equal(isMutualMatch(a, b), false);
});

test('bölge filtresi karşılıklı uyarsa eşleşir', () => {
  const a = mk({ region: 'TR', filterRegion: 'US' });
  const b = mk({ region: 'US', filterRegion: 'TR' });
  assert.equal(isMutualMatch(a, b), true);
});

test('cinsiyet uysa bile bölge uymazsa eşleşmez', () => {
  const a = mk({ gender: 'male', filterGender: 'female', region: 'TR', filterRegion: 'TR' });
  const b = mk({ gender: 'female', filterGender: 'male', region: 'DE', filterRegion: 'any' });
  assert.equal(isMutualMatch(a, b), false);
});
