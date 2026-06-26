const fs = require('fs');
const path = require('path');
const systemRepository = require('./system.repository');

const LOG_FILE = path.join(__dirname, '..', '..', '..', 'logs', 'app.log');

function parseMetadata(metadata) {
  if (!metadata) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(metadata));
  } catch (error) {
    return metadata;
  }
}

function getLatestAuditLogs() {
  return systemRepository.listLatestAuditLogs().map((log) => ({
    ...log,
    metadataText: parseMetadata(log.metadata),
  }));
}

function getLatestErrorLogs(limit = 40) {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const lines = fs
    .readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-300)
    .reverse();

  const errors = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      if (parsed.level >= 50 || parsed.event === 'request_error') {
        errors.push({
          time: parsed.time || '',
          level: parsed.level,
          message: parsed.msg || parsed.message || '',
          path: parsed.path || '',
          method: parsed.method || '',
          status: parsed.status || '',
        });
      }
    } catch (error) {
      // Ignore malformed log lines. The log view should never break admin support.
    }

    if (errors.length >= limit) {
      break;
    }
  }

  return errors;
}

function getSystemOverview() {
  return {
    auditLogs: getLatestAuditLogs(),
    errorLogs: getLatestErrorLogs(),
  };
}

module.exports = {
  getSystemOverview,
};
