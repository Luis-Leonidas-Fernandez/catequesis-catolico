const { db } = require('../../config/database');

function listLatestAuditLogs(limit = 80) {
  return db
    .prepare(
      `
        SELECT
          audit_logs.id,
          audit_logs.user_id,
          audit_logs.action,
          audit_logs.entity_type,
          audit_logs.entity_id,
          audit_logs.metadata,
          audit_logs.created_at,
          users.name AS user_name,
          users.email AS user_email
        FROM audit_logs
        LEFT JOIN users ON users.id = audit_logs.user_id
        ORDER BY audit_logs.id DESC
        LIMIT ?
      `,
    )
    .all(limit);
}

module.exports = {
  listLatestAuditLogs,
};
