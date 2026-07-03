const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbFilename: process.env.DB_FILENAME
    ? path.resolve(projectRoot, process.env.DB_FILENAME)
    : path.resolve(projectRoot, 'data/facechat.sqlite3'),
  moderationProvider: process.env.MODERATION_PROVIDER || 'none',
  moderationApiKey: process.env.MODERATION_API_KEY || '',
  autoBanFirstDurationMinutes: Number(process.env.AUTO_BAN_FIRST_DURATION_MINUTES) || 60,
  reportThreshold24h: Number(process.env.REPORT_THRESHOLD_24H) || 3,
};
