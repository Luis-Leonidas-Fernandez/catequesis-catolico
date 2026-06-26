function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function up(db) {
  if (!columnExists(db, 'children', 'avatar_path')) {
    db.exec('ALTER TABLE children ADD COLUMN avatar_path TEXT;');
  }

  if (!columnExists(db, 'children', 'access_code_hash')) {
    db.exec('ALTER TABLE children ADD COLUMN access_code_hash TEXT;');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_children_access_code_hash ON children(access_code_hash);
  `);
}

module.exports = {
  up,
};
