const { db } = require('../config/database');

function createAuditLog(entry) {
  return db
    .prepare(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      entry.userId || null,
      entry.action,
      entry.entityType,
      entry.entityId || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );
}

module.exports = {
  createAuditLog,
};
