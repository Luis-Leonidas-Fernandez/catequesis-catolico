function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS child_remember_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      selector TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id)
    );

    CREATE INDEX IF NOT EXISTS idx_child_remember_tokens_child_id
      ON child_remember_tokens(child_id);

    CREATE INDEX IF NOT EXISTS idx_child_remember_tokens_selector
      ON child_remember_tokens(selector);

    CREATE INDEX IF NOT EXISTS idx_child_remember_tokens_expires_at
      ON child_remember_tokens(expires_at);
  `);
}

module.exports = {
  up,
};
