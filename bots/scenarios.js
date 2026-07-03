const Bot = require('./bot');

/**
 * Otomatik senaryo testleri: hayalet/yeniden bağlanma, report→ban eşiği, block sonrası tekrar eşleşmeme.
 * Kullanım: node bots/scenarios.js
 */
const URL = process.env.URL || 'http://localhost:3000';
const results = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function bot(profile) {
  return new Bot(URL, profile).connect();
}

function record(title, ok, detail = '') {
  results.push({ title, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${title}${detail ? ' | ' + detail : ''}`);
}

// --- Senaryo 1: Hayalet/yeniden bağlanma — aynı deviceId kendiyle eşleşmemeli ---
async function testReconnectGhost() {
  const deviceId = `ghost-${Date.now()}`;
  let a1ForcedOut = false;
  let a2Matched = false;

  const a1 = bot({ deviceId, gender: 'male', region: 'x', filterGender: 'any', filterRegion: 'any' });
  a1.on('force-disconnect', (d) => { if (d && d.reason === 'reconnect') a1ForcedOut = true; });
  a1.on('ready', (_d, b) => b.joinQueue());
  await wait(400);

  // Aynı deviceId ile ikinci (yeni) bağlantı
  const a2 = bot({ deviceId, gender: 'male', region: 'x', filterGender: 'any', filterRegion: 'any' });
  a2.on('match', () => { a2Matched = true; });
  a2.on('ready', (_d, b) => b.joinQueue());
  await wait(700);

  record(
    'Hayalet temizliği: aynı deviceId kendi eski kopyasıyla EŞLEŞMEMELİ',
    !a2Matched && a1ForcedOut,
    `a2Matched=${a2Matched} a1ForcedOut=${a1ForcedOut}`
  );
  a1.close();
  a2.close();
}

// --- Senaryo 2: 3 şikayet → otomatik ban ---
async function testReportBan() {
  const victimId = `victim-${Date.now()}`;
  const threshold = 3;

  for (let i = 0; i < threshold; i += 1) {
    const reporter = bot({ deviceId: `rep-${i}-${Date.now()}`, gender: 'female', region: 'x', filterGender: 'any', filterRegion: 'any' });
    const victim = bot({ deviceId: victimId, gender: 'male', region: 'x', filterGender: 'any', filterRegion: 'any' });

    await new Promise((resolve) => {
      let matched = 0;
      const onMatch = () => { matched += 1; if (matched === 2) { reporter.report('inappropriate'); resolve(); } };
      reporter.on('match', onMatch);
      victim.on('match', onMatch);
      reporter.on('ready', (_d, b) => b.joinQueue());
      victim.on('ready', (_d, b) => b.joinQueue());
      setTimeout(resolve, 1500); // güvenlik zaman aşımı
    });

    await wait(300);
    reporter.close();
    victim.close();
    await wait(150);
  }

  // Kurban tekrar kuyruğa girmeyi denesin → banlı olmalı
  let banned = false;
  const check = bot({ deviceId: victimId, gender: 'male', region: 'x', filterGender: 'any', filterRegion: 'any' });
  check.on('banned', () => { banned = true; });
  check.on('ready', (_d, b) => b.joinQueue());
  await wait(700);

  record(`${threshold} şikayet sonrası kurban BANLANMALI`, banned, `banned=${banned}`);
  check.close();
}

// --- Senaryo 3: Block sonrası aynı çift tekrar eşleşmemeli ---
async function testBlockNoRematch() {
  const xId = `x-${Date.now()}`;
  const yId = `y-${Date.now()}`;
  const px = { deviceId: xId, gender: 'male', region: 'x', filterGender: 'any', filterRegion: 'any' };
  const py = { deviceId: yId, gender: 'female', region: 'x', filterGender: 'any', filterRegion: 'any' };

  const x = bot(px);
  const y = bot(py);

  // İlk eşleşme → X, Y'yi engeller
  await new Promise((resolve) => {
    let matched = 0;
    const onMatch = () => { matched += 1; if (matched === 2) { x.block(); resolve(); } };
    x.on('match', onMatch);
    y.on('match', onMatch);
    x.on('ready', (_d, b) => b.joinQueue());
    y.on('ready', (_d, b) => b.joinQueue());
    setTimeout(resolve, 1500);
  });

  await wait(400);

  // İkisi de tekrar kuyruğa girsin — başka kimse yokken eşleşmemeliler
  let rematched = false;
  x.on('match', () => { rematched = true; });
  y.on('match', () => { rematched = true; });
  x.joinQueue();
  y.joinQueue();
  await wait(900);

  record('Block sonrası aynı çift TEKRAR EŞLEŞMEMELİ', !rematched, `rematched=${rematched}`);
  x.close();
  y.close();
}

(async () => {
  console.log(`\n▶ Senaryo testleri | ${URL}\n`);
  await testReconnectGhost();
  await testReportBan();
  await testBlockNoRematch();

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? 'TÜM SENARYOLAR GEÇTİ ✅' : 'BAZI SENARYOLAR BAŞARISIZ ❌'}\n`);
  process.exit(allOk ? 0 : 1);
})();
