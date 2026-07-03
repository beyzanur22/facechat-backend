const knex = require('knex');
const fs = require('fs');
const path = require('path');
const knexConfig = require('./knexfile');
const config = require('../config');

const dbDir = path.dirname(config.dbFilename);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = knex(knexConfig);

module.exports = db;
