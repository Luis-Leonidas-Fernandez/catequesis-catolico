const { db } = require('../../config/database');

function listBackups() {
  return db
    .prepare(
      `
        SELECT
          backups.id,
          backups.file_path,
          backups.media_asset_id,
          backups.status,
          backups.created_at,
          users.name AS created_by_name,
          users.email AS created_by_email
        FROM backups
        LEFT JOIN users ON users.id = backups.created_by
        ORDER BY backups.id DESC
      `,
    )
    .all();
}

function createBackupRecord(backup) {
  const result = db
    .prepare(
      `
        INSERT INTO backups (file_path, media_asset_id, status, created_by)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(backup.filePath, backup.mediaAssetId || null, backup.status, backup.createdBy);

  return result.lastInsertRowid;
}

function findBackupById(id) {
  return db
    .prepare(
      `
        SELECT id, file_path, media_asset_id, status, created_by, created_at
        FROM backups
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id);
}

function createAuditLog(entry) {
  return db
    .prepare(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );
}

function runInTransaction(callback) {
  return db.transaction(callback)();
}

module.exports = {
  createAuditLog,
  createBackupRecord,
  findBackupById,
  listBackups,
  runInTransaction,
};
