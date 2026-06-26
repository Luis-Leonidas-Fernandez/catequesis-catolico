const { db } = require('../../config/database');

function tableExists(tableName) {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
      `,
    )
    .get(tableName);

  return Boolean(row);
}

function countActiveRows(tableName) {
  if (!tableExists(tableName)) {
    return null;
  }

  return db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM ${tableName}
        WHERE is_active = 1
          AND deleted_at IS NULL
      `,
    )
    .get().total;
}

function getAdminCounters() {
  return {
    activeUsers: countActiveRows('users'),
    activeChildren: countActiveRows('children'),
    activeGroups: countActiveRows('groups'),
    activeActivities: countActiveRows('activities'),
  };
}

module.exports = {
  getAdminCounters,
};
