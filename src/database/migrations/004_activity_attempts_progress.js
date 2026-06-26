function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function up(db) {
  if (!columnExists(db, 'activity_attempts', 'correct_answers')) {
    db.exec('ALTER TABLE activity_attempts ADD COLUMN correct_answers INTEGER NOT NULL DEFAULT 0;');
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_attempts_active_child_activity
      ON activity_attempts(child_id, activity_id)
      WHERE completed_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_question_attempts_question_id
      ON question_attempts(question_id);
  `);
}

module.exports = {
  up,
};
