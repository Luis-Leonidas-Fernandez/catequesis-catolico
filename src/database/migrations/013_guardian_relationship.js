function up(db) {
  const columns = db.prepare('PRAGMA table_info(children)').all();
  if (!columns.some((column) => column.name === 'guardian_relationship')) {
    db.exec("ALTER TABLE children ADD COLUMN guardian_relationship TEXT NOT NULL DEFAULT 'tutor'");
  }
}

module.exports = { up };
