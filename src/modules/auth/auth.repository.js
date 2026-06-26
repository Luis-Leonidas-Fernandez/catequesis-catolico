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

module.exports = {
  findActiveUserByEmail,
  findActiveUserById,
};
