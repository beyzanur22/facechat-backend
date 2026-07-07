const path = require('path');
const config = require('../config');

// Fail-fast: bağlantı adresi yoksa uygulama açılmadan, net bir mesajla dur.
if (!config.databaseUrl) {
  throw new Error(
    'DATABASE_URL tanımlı değil. .env dosyanıza Postgres bağlantı adresini ekleyin ' +
      '(ör. DATABASE_URL=postgres://user:pass@host:5432/dbname).'
  );
}

module.exports = {
  client: 'pg',
  connection: {
    connectionString: config.databaseUrl,
    // Bulut Postgres (Neon/Render/Supabase) SSL bekler.
    ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
  },
  pool: { min: config.poolMin, max: config.poolMax },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
  },
};
