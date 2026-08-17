const LEVELS = [
  ['catequesis_familiar', 'Nivel de catequesis familiar.', 1],
  ['catequesis_juvenil', 'Nivel de catequesis juvenil.', 2],
  ['catequesis_bautismal', 'Nivel de catequesis bautismal.', 3],
];

function up(db) {
  const findLevel = db.prepare('SELECT id FROM catechesis_levels WHERE name = ? LIMIT 1');
  const insertLevel = db.prepare(
    'INSERT INTO catechesis_levels (name, description, display_order) VALUES (?, ?, ?)',
  );
  const activateLevel = db.prepare(
    `UPDATE catechesis_levels
     SET is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE name = ?`,
  );

  for (const [name, description, displayOrder] of LEVELS) {
    if (!findLevel.get(name)) {
      insertLevel.run(name, description, displayOrder);
    } else {
      activateLevel.run(name);
    }
  }
}

module.exports = { up };
