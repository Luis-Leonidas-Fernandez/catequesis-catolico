function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_type TEXT NOT NULL,
      owner_id INTEGER,
      parish_id INTEGER,
      kind TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
      access_scope TEXT NOT NULL CHECK (access_scope IN ('global', 'parish', 'admin_only')),
      provider TEXT NOT NULL DEFAULT 'cloudinary',
      cloudinary_public_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      secure_url TEXT,
      format TEXT,
      mime_type TEXT,
      bytes INTEGER,
      width INTEGER,
      height INTEGER,
      checksum_sha256 TEXT,
      original_filename TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      FOREIGN KEY (parish_id) REFERENCES parishes(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_media_assets_owner
      ON media_assets(owner_type, owner_id);
    CREATE INDEX IF NOT EXISTS idx_media_assets_parish_id
      ON media_assets(parish_id);
    CREATE INDEX IF NOT EXISTS idx_media_assets_checksum
      ON media_assets(checksum_sha256);
    CREATE INDEX IF NOT EXISTS idx_media_assets_public_id
      ON media_assets(cloudinary_public_id);
  `);

  if (!columnExists(db, 'activities', 'media_asset_id')) {
    db.exec('ALTER TABLE activities ADD COLUMN media_asset_id INTEGER;');
  }

  if (!columnExists(db, 'guides', 'media_asset_id')) {
    db.exec('ALTER TABLE guides ADD COLUMN media_asset_id INTEGER;');
  }

  if (!columnExists(db, 'backups', 'media_asset_id')) {
    db.exec('ALTER TABLE backups ADD COLUMN media_asset_id INTEGER;');
  }
}

module.exports = {
  up,
};
