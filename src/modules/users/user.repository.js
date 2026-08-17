const { db } = require('../../config/database');

function listUsers() {
  return db
    .prepare(
      `
        SELECT
          users.id,
          users.name,
          users.email,
          users.role,
          users.is_active,
          users.created_at,
          users.updated_at,
          parishes.name AS parish_name
        FROM users
        LEFT JOIN parishes ON parishes.id = users.parish_id
        WHERE users.deleted_at IS NULL
        ORDER BY users.is_active DESC, users.name ASC
      `,
    )
    .all();
}

function listCatechistLevelIds(catechistId) {
  return db.prepare(`
    SELECT catechesis_level_id
    FROM catechist_levels
    WHERE catechist_id = ?
    ORDER BY catechesis_level_id ASC
  `).all(catechistId).map((row) => row.catechesis_level_id);
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


function listCatechistsByParish(parishId) {
  return db
    .prepare(
      `
        SELECT
          users.id,
          users.name,
          users.email,
          users.role,
          users.is_active,
          users.created_at,
          parishes.name AS parish_name,
          COUNT(groups.id) AS groups_count
        FROM users
        LEFT JOIN parishes ON parishes.id = users.parish_id
        LEFT JOIN groups ON groups.catechist_id = users.id
          AND groups.deleted_at IS NULL
        WHERE users.deleted_at IS NULL
          AND users.parish_id = ?
          AND users.role = 'catequista'
        GROUP BY users.id
        ORDER BY users.is_active DESC, users.name ASC
      `,
    )
    .all(parishId);
}

function findUserById(id) {
  return db
    .prepare(
      `
        SELECT
          id,
          parish_id,
          name,
          email,
          role,
          is_active
        FROM users
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function findUserByEmail(email) {
  return db
    .prepare(
      `
        SELECT id, email
        FROM users
        WHERE email = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(email);
}

function createUser(user) {
  const result = db
    .prepare(
      `
        INSERT INTO users (parish_id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(user.parishId, user.name, user.email, user.passwordHash, user.role);

  return result.lastInsertRowid;
}

function updateUser(user) {
  if (user.passwordHash) {
    return db
      .prepare(
        `
          UPDATE users
          SET parish_id = ?,
              name = ?,
              email = ?,
              password_hash = ?,
              role = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND deleted_at IS NULL
        `,
      )
      .run(user.parishId, user.name, user.email, user.passwordHash, user.role, user.id);
  }

  return db
    .prepare(
      `
        UPDATE users
        SET parish_id = ?,
            name = ?,
            email = ?,
            role = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(user.parishId, user.name, user.email, user.role, user.id);
}

function deactivateUser(id) {
  return db
    .prepare(
      `
        UPDATE users
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(id);
}

function activateInactiveUser(id) {
  return db
    .prepare(
      `
        UPDATE users
        SET is_active = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND is_active = 0
          AND deleted_at IS NULL
      `,
    )
    .run(id);
}

function replaceCatechistLevels(catechistId, levelIds) {
  db.prepare('DELETE FROM catechist_levels WHERE catechist_id = ?').run(catechistId);
  const assignLevel = db.prepare(
    'INSERT INTO catechist_levels (catechist_id, catechesis_level_id) VALUES (?, ?)',
  );

  for (const levelId of levelIds) {
    assignLevel.run(catechistId, levelId);
  }
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
  activateInactiveUser,
  createAuditLog,
  createUser,
  deactivateUser,
  findUserByEmail,
  findUserById,
  listActiveParishes,
  listCatechistLevelIds,
  listCatechistsByParish,
  listUsers,
  runInTransaction,
  replaceCatechistLevels,
  updateUser,
};
