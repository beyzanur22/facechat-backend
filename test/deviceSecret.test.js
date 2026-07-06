const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateSecret, hashSecret, verifySecret } = require('../src/utils/deviceSecret');

test('generateSecret üretir ve her seferinde farklıdır', () => {
  const a = generateSecret();
  const b = generateSecret();
  assert.equal(typeof a, 'string');
  assert.equal(a.length, 64); // 32 byte hex
  assert.notEqual(a, b);
});

test('verifySecret doğru secret için true döner', () => {
  const secret = generateSecret();
  const hash = hashSecret(secret);
  assert.equal(verifySecret(secret, hash), true);
});

test('verifySecret yanlış secret için false döner', () => {
  const hash = hashSecret(generateSecret());
  assert.equal(verifySecret(generateSecret(), hash), false);
});

test('verifySecret eksik/boş girdilerde güvenle false döner', () => {
  assert.equal(verifySecret(null, 'x'), false);
  assert.equal(verifySecret('x', null), false);
  assert.equal(verifySecret('', ''), false);
});

test('verifySecret farklı uzunluktaki hash ile patlamadan false döner', () => {
  assert.equal(verifySecret('abc', 'deadbeef'), false);
});
