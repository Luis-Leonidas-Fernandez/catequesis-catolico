function up(db) {
  const columns = db.prepare('PRAGMA table_info(guides)').all();
  const hasYear = columns.some((column) => column.name === 'year');

  if (!hasYear) {
    db.exec('ALTER TABLE guides ADD COLUMN year INTEGER;');
  }

  const currentYear = new Date().getFullYear();

  db.prepare('UPDATE guides SET year = ? WHERE year IS NULL').run(currentYear);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_guides_year
      ON guides(year);
  `);
}

module.exports = {
  up,
};
