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
          AND users.role IN ('catequista_familiar', 'catequista_juvenil')
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
  createUser,
  deactivateUser,
  findUserByEmail,
  findUserById,
  listActiveParishes,
  listCatechistsByParish,
  listUsers,
  runInTransaction,
  updateUser,
};
