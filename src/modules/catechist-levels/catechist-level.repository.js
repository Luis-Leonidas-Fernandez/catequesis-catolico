const { db } = require('../../config/database');

function listActiveLevels() {
  return db.prepare(`
    SELECT id, name, description, display_order
    FROM catechesis_levels
    WHERE is_active = 1 AND deleted_at IS NULL
    ORDER BY display_order ASC, name ASC
  `).all();
}

function listActiveLevelsByNames(levelNames) {
  if (levelNames.length === 0) {
    return [];
  }

  const placeholders = levelNames.map(() => '?').join(', ');

  return db.prepare(`
    SELECT id, name, description, display_order
    FROM catechesis_levels
    WHERE is_active = 1
      AND deleted_at IS NULL
      AND name IN (${placeholders})
    ORDER BY display_order ASC, name ASC
  `).all(...levelNames);
}

function listLevelsForCatechist(catechistId) {
  return db.prepare(`
    SELECT catechesis_levels.id, catechesis_levels.name, catechesis_levels.description, catechesis_levels.display_order
    FROM catechist_levels
    INNER JOIN catechesis_levels ON catechesis_levels.id = catechist_levels.catechesis_level_id
    WHERE catechist_levels.catechist_id = ?
      AND catechesis_levels.is_active = 1
      AND catechesis_levels.deleted_at IS NULL
    ORDER BY catechesis_levels.display_order ASC, catechesis_levels.name ASC
  `).all(catechistId);
}

function replaceLevelsForCatechist(catechistId, levelIds) {
  db.prepare('DELETE FROM catechist_levels WHERE catechist_id = ?').run(catechistId);
  const assign = db.prepare(
    'INSERT INTO catechist_levels (catechist_id, catechesis_level_id) VALUES (?, ?)',
  );

  for (const levelId of levelIds) {
    assign.run(catechistId, levelId);
  }
}

module.exports = {
  listActiveLevels,
  listActiveLevelsByNames,
  listLevelsForCatechist,
  replaceLevelsForCatechist,
};
