function up(db) {
  const columns = db.prepare('PRAGMA table_info(children)').all();
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has('follow_up_note')) {
    db.exec('ALTER TABLE children ADD COLUMN follow_up_note TEXT');
  }

  if (!existing.has('follow_up_active')) {
    db.exec('ALTER TABLE children ADD COLUMN follow_up_active INTEGER NOT NULL DEFAULT 0');
  }
}

module.exports = { up };
