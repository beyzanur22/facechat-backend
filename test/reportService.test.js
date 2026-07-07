const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// reportService'in bağımlılıklarını (db/config/banService/metrics) require edilmeden ÖNCE
// mock'la. Böylece gerçek Postgres/Redis'e dokunmadan sadece iş mantığını test ederiz.
let throwUnique = false;
let countValue = 0;
const inserted = [];
const banCalls = [];

function inject(relPath, exports) {
  const p = require.resolve(relPath);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}

inject('../src/db', function db() {
  const builder = {
    insert: async (row) => {
      if (throwUnique) {
        const e = new Error('duplicate');
        e.code = '23505';
        throw e;
      }
      inserted.push(row);
      return [1];
    },
    where() {
      return builder;
    },
    andWhere() {
      return builder;
    },
    count: async () => [{ count: countValue }],
  };
  return builder;
});
inject('../src/config', { reportThreshold24h: 3, autoBanFirstDurationMinutes: 60 });
inject('../src/services/banService', {
  autoban: async (...args) => {
    banCalls.push(args);
    return { permanent: false, expiresAt: null };
  },
});
inject('../src/observability/metrics', { reportsTotal: { inc() {} } });

const reportService = require('../src/services/reportService');

beforeEach(() => {
  throwUnique = false;
  countValue = 0;
  inserted.length = 0;
  banCalls.length = 0;
});

test('eşik altındaki raporda ban tetiklenmez', async () => {
  countValue = 1;
  const r = await reportService.fileReport({
    reporterDeviceId: 'r',
    reportedDeviceId: 'x',
    sessionId: 's1',
    reason: 'spam',
  });
  assert.equal(r.banResult, null);
  assert.equal(banCalls.length, 0);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].reason, 'spam');
});

test('24s içinde eşik aşılınca autoban çağrılır (raporlanan cihaz için)', async () => {
  countValue = 3; // == reportThreshold24h
  const r = await reportService.fileReport({
    reporterDeviceId: 'r',
    reportedDeviceId: 'x',
    sessionId: 's2',
    reason: 'nudity',
  });
  assert.ok(r.banResult);
  assert.equal(banCalls.length, 1);
  assert.equal(banCalls[0][0], 'x'); // autoban(reportedDeviceId, ...)
});

test('aynı session tekrar rapor (unique violation) sessizce no-op', async () => {
  throwUnique = true;
  const r = await reportService.fileReport({
    reporterDeviceId: 'r',
    reportedDeviceId: 'x',
    sessionId: 's3',
    reason: 'spam',
  });
  assert.equal(r.duplicate, true);
  assert.equal(r.banResult, null);
  assert.equal(banCalls.length, 0);
});

test('whitelist dışı reason "other"a normalize edilir', async () => {
  countValue = 1;
  await reportService.fileReport({
    reporterDeviceId: 'r',
    reportedDeviceId: 'x',
    sessionId: 's4',
    reason: '<script>',
  });
  assert.equal(inserted[0].reason, 'other');
});
