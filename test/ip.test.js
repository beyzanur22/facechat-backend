const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashIp } = require('../src/utils/ip');

test('hashIp aynı IP için tutarlı hash üretir', () => {
  const a = hashIp('1.2.3.4');
  const b = hashIp('1.2.3.4');
  assert.equal(a, b);
});

test('hashIp farklı IP için farklı hash üretir', () => {
  assert.notEqual(hashIp('1.2.3.4'), hashIp('5.6.7.8'));
});

test('hashIp boş girdide null döner', () => {
  assert.equal(hashIp(''), null);
  assert.equal(hashIp(null), null);
});

test('hashIp ham IP\'yi çıktıda döndürmez', () => {
  const hash = hashIp('9.9.9.9');
  assert.ok(!hash.includes('9.9.9.9'));
  assert.equal(hash.length, 64); // sha256 hex
});
