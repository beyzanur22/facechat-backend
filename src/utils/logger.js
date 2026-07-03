const levels = ['debug', 'info', 'warn', 'error'];

function log(level, ...args) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`[${ts}] [${level.toUpperCase()}]`, ...args);
}

const logger = {};
for (const level of levels) {
  logger[level] = (...args) => log(level, ...args);
}

module.exports = logger;
