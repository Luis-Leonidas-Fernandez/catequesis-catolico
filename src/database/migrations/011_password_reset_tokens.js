function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
      ON password_reset_tokens(user_id);

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
      ON password_reset_tokens(token_hash);

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
      ON password_reset_tokens(expires_at);
  `);
}

module.exports = {
  up,
};
