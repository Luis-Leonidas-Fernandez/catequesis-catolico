function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS child_follow_up_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_child_follow_up_notes_child_id
      ON child_follow_up_notes(child_id);
  `);

  db.exec(`
    INSERT INTO child_follow_up_notes (child_id, note)
    SELECT id, follow_up_note
    FROM children
    WHERE follow_up_note IS NOT NULL
      AND TRIM(follow_up_note) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM child_follow_up_notes notes WHERE notes.child_id = children.id
      );
  `);
}

module.exports = { up };
