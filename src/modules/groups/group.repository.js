const { db } = require('../../config/database');

function listGroups() {
  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.year,
          groups.is_active,
          groups.parish_id,
          groups.catechesis_level_id,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name,
          users.name AS catechist_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        LEFT JOIN users ON users.id = groups.catechist_id
        WHERE groups.deleted_at IS NULL
        ORDER BY groups.is_active DESC, groups.year DESC, groups.name ASC
      `,
    )
    .all();
}

function listGroupsByParish(parishId) {
  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.year,
          groups.is_active,
          groups.parish_id,
          groups.catechesis_level_id,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name,
          users.name AS catechist_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        LEFT JOIN users ON users.id = groups.catechist_id
        WHERE groups.deleted_at IS NULL
          AND groups.parish_id = ?
        ORDER BY groups.is_active DESC, groups.year DESC, groups.name ASC
      `,
    )
    .all(parishId);
}

function listGroupsByCatechist(catechistId) {
  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.year,
          groups.is_active,
          groups.parish_id,
          groups.catechesis_level_id,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name,
          users.name AS catechist_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        LEFT JOIN users ON users.id = groups.catechist_id
        WHERE groups.deleted_at IS NULL
          AND groups.catechist_id = ?
        ORDER BY groups.is_active DESC, groups.year DESC, groups.name ASC
      `,
    )
    .all(catechistId);
}

function findGroupById(id) {
  return db
    .prepare(
      `
        SELECT
          id,
          parish_id,
          catechesis_level_id,
          catechist_id,
          name,
          year,
          is_active
        FROM groups
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
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

function listActiveCatechists(parishId = null) {
  const params = [];
  let parishFilter = '';

  if (parishId) {
    parishFilter = 'AND parish_id = ?';
    params.push(parishId);
  }

  return db
    .prepare(
      `
        SELECT id, name, email, role, parish_id
        FROM users
        WHERE is_active = 1
          AND deleted_at IS NULL
          AND role IN ('catequista_familiar', 'catequista_juvenil')
          ${parishFilter}
        ORDER BY name ASC
      `,
    )
    .all(...params);
}

function createGroup(group) {
  const result = db
    .prepare(
      `
        INSERT INTO groups (parish_id, catechesis_level_id, catechist_id, name, year)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(group.parishId, group.catechesisLevelId, group.catechistId, group.name, group.year);

  return result.lastInsertRowid;
}

function updateGroup(group) {
  return db
    .prepare(
      `
        UPDATE groups
        SET parish_id = ?,
            catechesis_level_id = ?,
            catechist_id = ?,
            name = ?,
            year = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(
      group.parishId,
      group.catechesisLevelId,
      group.catechistId,
      group.name,
      group.year,
      group.id,
    );
}

function deactivateGroup(id) {
  return db
    .prepare(
      `
        UPDATE groups
        SET is_active = 0,
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
  createGroup,
  deactivateGroup,
  findGroupById,
  listActiveCatechesisLevels,
  listActiveCatechists,
  listActiveParishes,
  listGroups,
  listGroupsByCatechist,
  listGroupsByParish,
  runInTransaction,
  updateGroup,
};
