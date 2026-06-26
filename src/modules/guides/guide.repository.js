const { db } = require('../../config/database');

function listGuides(filters = {}) {
  const params = [];
  let where = 'WHERE guides.deleted_at IS NULL';

  if (filters.parishId) {
    where += ' AND guides.parish_id = ?';
    params.push(filters.parishId);
  }

  if (filters.catechesisLevelId) {
    where += ' AND guides.catechesis_level_id = ?';
    params.push(filters.catechesisLevelId);
  }

  if (filters.onlyActive) {
    where += ' AND guides.is_active = 1';
  }

  return db
    .prepare(
      `
        SELECT
          guides.id,
          guides.title,
          guides.description,
          guides.file_path,
          guides.media_asset_id,
          guides.year,
          guides.is_active,
          guides.created_at,
          guides.parish_id,
          catechesis_levels.name AS catechesis_level_name,
          parishes.name AS parish_name,
          users.name AS created_by_name
        FROM guides
        LEFT JOIN catechesis_levels ON catechesis_levels.id = guides.catechesis_level_id
        LEFT JOIN parishes ON parishes.id = guides.parish_id
        LEFT JOIN users ON users.id = guides.created_by
        ${where}
        ORDER BY guides.created_at DESC, guides.id DESC
      `,
    )
    .all(...params);
}

function listActiveCatechesisLevels() {
  return db
    .prepare(
      `
        SELECT id, name
        FROM catechesis_levels
        WHERE is_active = 1
          AND deleted_at IS NULL
        ORDER BY display_order ASC, name ASC
      `,
    )
    .all();
}

function listActiveParishes() {
  return db
    .prepare(
      `
        SELECT id, name
        FROM parishes
        WHERE is_active = 1
          AND deleted_at IS NULL
        ORDER BY name ASC
      `,
    )
    .all();
}

function findGuideById(id) {
  return db
    .prepare(
      `
        SELECT
          guides.id,
          guides.title,
          guides.description,
          guides.file_path,
          guides.media_asset_id,
          guides.catechesis_level_id,
          guides.parish_id,
          guides.year,
          guides.is_active,
          parishes.name AS parish_name
        FROM guides
        LEFT JOIN parishes ON parishes.id = guides.parish_id
        WHERE guides.id = ?
          AND guides.deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function createGuide(guide) {
  const result = db
    .prepare(
      `
        INSERT INTO guides (
          parish_id,
          catechesis_level_id,
          title,
          description,
          file_path,
          media_asset_id,
          year,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      guide.parishId,
      guide.catechesisLevelId,
      guide.title,
      guide.description,
      guide.filePath,
      guide.mediaAssetId || null,
      guide.year,
      guide.createdBy,
    );

  return result.lastInsertRowid;
}

function softDeleteGuide(id) {
  return db
    .prepare(
      `
        UPDATE guides
        SET deleted_at = CURRENT_TIMESTAMP,
            is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(id);
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
  createGuide,
  findGuideById,
  listActiveCatechesisLevels,
  listActiveParishes,
  listGuides,
  runInTransaction,
  softDeleteGuide,
};
