function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS coordinator_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (
        role IN ('coordinador_zonal', 'coordinador_parroquial')
      ),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      parish_id INTEGER,
      created_user_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parish_id) REFERENCES parishes(id),
      FOREIGN KEY (created_user_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_coordinator_invitations_email
      ON coordinator_invitations(email);

    CREATE INDEX IF NOT EXISTS idx_coordinator_invitations_token_hash
      ON coordinator_invitations(token_hash);

    CREATE INDEX IF NOT EXISTS idx_coordinator_invitations_expires_at
      ON coordinator_invitations(expires_at);
  `);
}

module.exports = {
  up,
};
