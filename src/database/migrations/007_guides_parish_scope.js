function up(db) {
  const columns = db.prepare('PRAGMA table_info(guides)').all();
  const hasParishId = columns.some((column) => column.name === 'parish_id');
  const hasCreatedBy = columns.some((column) => column.name === 'created_by');

  if (!hasParishId) {
    db.exec('ALTER TABLE guides ADD COLUMN parish_id INTEGER REFERENCES parishes(id);');
  }

  if (!hasCreatedBy) {
    db.exec('ALTER TABLE guides ADD COLUMN created_by INTEGER REFERENCES users(id);');
  }

  db.exec(`
    UPDATE guides
    SET parish_id = COALESCE(
      parish_id,
      (SELECT id FROM parishes WHERE name = 'San Pedro' AND deleted_at IS NULL LIMIT 1),
      (SELECT id FROM parishes WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1)
    )
    WHERE parish_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_guides_parish_id
      ON guides(parish_id);

    CREATE INDEX IF NOT EXISTS idx_guides_created_by
      ON guides(created_by);
  `);
}

module.exports = {
  up,
};
