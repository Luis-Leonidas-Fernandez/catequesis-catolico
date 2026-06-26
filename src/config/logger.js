const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logsDirectory = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(logsDirectory, { recursive: true });

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'catequesis-san-pedro',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.destination(path.join(logsDirectory, 'app.log')),
);

module.exports = logger;
