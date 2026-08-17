const { db } = require('../../config/database');

function findActiveUserByEmail(email) {
  return db
    .prepare(
      `
        SELECT
          id,
          parish_id,
          name,
          email,
          password_hash,
          role,
          is_active
        FROM users
        WHERE email = ?
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(email);
}

function findActiveUserById(id) {
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
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function findPasswordResetUserByEmail(email) {
  return db
    .prepare(
      `
        SELECT id, email, role, is_active
        FROM users
        WHERE email = ?
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(email);
}

function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  return db
    .prepare(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `,
    )
    .run(userId, tokenHash, expiresAt);
}

function findValidPasswordResetToken(tokenHash) {
  return db
    .prepare(
      `
        SELECT
          password_reset_tokens.id,
          password_reset_tokens.user_id,
          password_reset_tokens.expires_at,
          users.email,
          users.role
        FROM password_reset_tokens
        INNER JOIN users ON users.id = password_reset_tokens.user_id
        WHERE password_reset_tokens.token_hash = ?
          AND password_reset_tokens.used_at IS NULL
          AND password_reset_tokens.expires_at > CURRENT_TIMESTAMP
          AND users.is_active = 1
          AND users.deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(tokenHash);
}

function invalidateUnusedPasswordResetTokens(userId) {
  return db
    .prepare(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND used_at IS NULL
      `,
    )
    .run(userId);
}

function updateUserPassword(userId, passwordHash) {
  return db
    .prepare(
      `
        UPDATE users
        SET password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .run(passwordHash, userId);
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
      entry.userId || null,
      entry.action,
      entry.entityType,
      entry.entityId || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );
}

function runInTransaction(callback) {
  return db.transaction(callback)();
}

module.exports = {
  createAuditLog,
  createPasswordResetToken,
  findActiveUserByEmail,
  findActiveUserById,
  findPasswordResetUserByEmail,
  findValidPasswordResetToken,
  invalidateUnusedPasswordResetTokens,
  runInTransaction,
  updateUserPassword,
};
