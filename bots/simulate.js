const Bot = require('./bot');

/**
 * Bot yük/akış simülatörü.
 *
 * Kullanım:
 *   node bots/simulate.js --bots 20 --mode churn --duration 8
 *   node bots/simulate.js --bots 10 --mode match
 *
 * Modlar:
 *   match  — tüm botlar bir kez kuyruğa girer, kaç çift bağlandı ölçülür
 *   churn  — botlar sürekli eşleşir→kısa süre bekler→skip→tekrar kuyruk (gerçekçi trafik)
 */
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const URL = arg('url', 'http://localhost:3000');
const NUM_BOTS = parseInt(arg('bots', '20'), 10);
const MODE = arg('mode', 'churn');
const DURATION = parseInt(arg('duration', '8'), 10) * 1000;

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const genders = ['male', 'female'];
const regions = ['TR', 'US', 'DE'];

function makeProfile(i) {
  const gender = rand(genders);
  // Botların çoğu "herkes" ister, bir kısmı cinsiyet filtreli (gerçekçi dağılım).
  const filterGender = Math.random() < 0.7 ? 'any' : rand(genders);
  return {
    deviceId: `bot-${i}-${Date.now()}`,
    gender,
    region: rand(regions),
    filterGender,
    filterRegion: 'any',
  };
}

function schedule(bot) {
  // Eşleşince/bağlanınca kısa süre sonra skip edip tekrar kuyruğa gir.
  const relPause = 300 + Math.random() * 900;
  setTimeout(() => {
    if (bot.state === 'connected' || bot.state === 'matched') bot.skip();
    if (bot.state !== 'banned') bot.joinQueue();
  }, relPause);
}

async function run() {
  console.log(`\n▶ ${NUM_BOTS} bot | mod=${MODE} | süre=${DURATION / 1000}s | ${URL}\n`);
  const bots = [];

  for (let i = 0; i < NUM_BOTS; i += 1) {
    const bot = new Bot(URL, makeProfile(i)).connect();
    bot.on('ready', (_d, b) => b.joinQueue());

    if (MODE === 'churn') {
      bot.on('connected-peer', (_d, b) => schedule(b));
      bot.on('peer-left', (_d, b) => { if (b.state !== 'banned') b.joinQueue(); });
      bot.on('force-disconnect', (_d, b) => { if (b.state !== 'banned') b.joinQueue(); });
    }
    bots.push(bot);
    // Bağlanmaları hafif dağıt (thundering herd önle).
    await new Promise((r) => setTimeout(r, 15));
  }

  await new Promise((r) => setTimeout(r, DURATION));

  const total = bots.reduce(
    (acc, b) => {
      acc.matches += b.stats.matches;
      acc.connects += b.stats.connects;
      acc.skips += b.stats.skips;
      acc.waiting += b.stats.waiting;
      acc.banned += b.stats.banned;
      return acc;
    },
    { matches: 0, connects: 0, skips: 0, waiting: 0, banned: 0 }
  );

  const stillWaiting = bots.filter((b) => b.state === 'waiting' || b.state === 'queued').length;

  console.log('=== SİMÜLASYON SONUCU ===');
  console.log(`Toplam eşleşme (match-found): ${total.matches}`);
  console.log(`Bağlanan (sinyal el sıkışma tamam): ${total.connects}`);
  console.log(`Skip sayısı: ${total.skips}`);
  console.log(`Kuyrukta bekleyen (anlık): ${stillWaiting}`);
  console.log(`Banlanan: ${total.banned}`);
  console.log('=========================\n');

  bots.forEach((b) => b.close());
  process.exit(0);
}

run();
