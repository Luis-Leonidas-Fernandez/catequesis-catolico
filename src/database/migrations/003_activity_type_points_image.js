function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function up(db) {
  if (!columnExists(db, 'activities', 'activity_type')) {
    db.exec("ALTER TABLE activities ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'question_answer';");
  }

  if (!columnExists(db, 'activities', 'points')) {
    db.exec('ALTER TABLE activities ADD COLUMN points INTEGER NOT NULL DEFAULT 10;');
  }

  if (!columnExists(db, 'activities', 'image_path')) {
    db.exec('ALTER TABLE activities ADD COLUMN image_path TEXT;');
  }
}

module.exports = {
  up,
};
