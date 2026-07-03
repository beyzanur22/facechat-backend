const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbDir = path.dirname(config.dbFilename);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

module.exports = {
  client: 'better-sqlite3',
  connection: {
    filename: config.dbFilename,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
  },
};
