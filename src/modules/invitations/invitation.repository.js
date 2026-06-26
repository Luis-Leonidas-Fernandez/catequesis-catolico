const { db } = require('../../config/database');

function createInvitation(invitation) {
  const result = db
    .prepare(
      `
        INSERT INTO coordinator_invitations (email, role, token_hash, expires_at, created_by)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      invitation.email,
      invitation.role,
      invitation.tokenHash,
      invitation.expiresAt,
      invitation.createdBy,
    );

  return result.lastInsertRowid;
}

function listInvitations() {
  return db
    .prepare(
      `
        SELECT
          coordinator_invitations.id,
          coordinator_invitations.email,
          coordinator_invitations.role,
          coordinator_invitations.expires_at,
          coordinator_invitations.used_at,
          coordinator_invitations.created_at,
          coordinator_invitations.parish_id,
          coordinator_invitations.created_user_id,
          creators.name AS created_by_name,
          parishes.name AS parish_name,
          created_users.name AS created_user_name
        FROM coordinator_invitations
        INNER JOIN users creators ON creators.id = coordinator_invitations.created_by
        LEFT JOIN parishes ON parishes.id = coordinator_invitations.parish_id
        LEFT JOIN users created_users ON created_users.id = coordinator_invitations.created_user_id
        ORDER BY coordinator_invitations.created_at DESC, coordinator_invitations.id DESC
      `,
    )
    .all();
}

function findInvitationByTokenHash(tokenHash) {
  return db
    .prepare(
      `
        SELECT
          id,
          email,
          role,
          token_hash,
          expires_at,
          used_at,
          parish_id,
          created_user_id,
          created_by,
          created_at
        FROM coordinator_invitations
        WHERE token_hash = ?
        LIMIT 1
      `,
    )
    .get(tokenHash);
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

function findParishByName(name) {
  return db
    .prepare(
      `
        SELECT id, name
        FROM parishes
        WHERE lower(name) = lower(?)
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(name);
}

function createParish(name) {
  const result = db
    .prepare(
      `
        INSERT INTO parishes (name)
        VALUES (?)
      `,
    )
    .run(name);

  return result.lastInsertRowid;
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

function markInvitationUsed({ id, parishId, createdUserId }) {
  return db
    .prepare(
      `
        UPDATE coordinator_invitations
        SET used_at = CURRENT_TIMESTAMP,
            parish_id = ?,
            created_user_id = ?
        WHERE id = ?
      `,
    )
    .run(parishId, createdUserId, id);
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
  createInvitation,
  createParish,
  createUser,
  findInvitationByTokenHash,
  findParishByName,
  findUserByEmail,
  listInvitations,
  markInvitationUsed,
  runInTransaction,
};
