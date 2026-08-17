function up(db) {
  const columns = db.prepare('PRAGMA table_info(children)').all();
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has('godfather_name')) {
    db.exec('ALTER TABLE children ADD COLUMN godfather_name TEXT');
  }

  if (!existing.has('godmother_name')) {
    db.exec('ALTER TABLE children ADD COLUMN godmother_name TEXT');
  }
}

module.exports = { up };
