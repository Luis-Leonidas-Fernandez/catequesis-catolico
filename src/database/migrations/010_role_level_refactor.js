const LEGACY_ROLE_LEVELS = {
  catequista_familiar: 'catequesis_familiar',
  catequista_juvenil: 'catequesis_juvenil',
};

const LEVELS = [
  ['catequesis_familiar', 'Nivel de catequesis familiar.', 1],
  ['catequesis_juvenil', 'Nivel de catequesis juvenil.', 2],
  ['catequesis_bautismal', 'Nivel de catequesis bautismal.', 3],
];

function ensureLevels(db) {
  const findLevel = db.prepare('SELECT id FROM catechesis_levels WHERE name = ? AND deleted_at IS NULL');
  const createLevel = db.prepare(
    'INSERT INTO catechesis_levels (name, description, display_order) VALUES (?, ?, ?)',
  );

  for (const [name, description, displayOrder] of LEVELS) {
    if (!findLevel.get(name)) {
      createLevel.run(name, description, displayOrder);
    }
  }

  const levelNames = LEVELS.map(([name]) => name);
  const placeholders = levelNames.map(() => '?').join(', ');
  db.prepare(`
    UPDATE catechesis_levels
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE deleted_at IS NULL
      AND name NOT IN (${placeholders})
  `).run(...levelNames);
}

function ensureCatechistLevelsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catechist_levels (
      catechist_id INTEGER NOT NULL,
      catechesis_level_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (catechist_id, catechesis_level_id),
      FOREIGN KEY (catechist_id) REFERENCES users(id),
      FOREIGN KEY (catechesis_level_id) REFERENCES catechesis_levels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_catechist_levels_level_id
      ON catechist_levels(catechesis_level_id);
  `);
}

function migrateLegacyAssignments(db) {
  const findLevel = db.prepare('SELECT id FROM catechesis_levels WHERE name = ? AND deleted_at IS NULL');
  const assignLevel = db.prepare(
    'INSERT OR IGNORE INTO catechist_levels (catechist_id, catechesis_level_id) VALUES (?, ?)',
  );
  const findLegacyCatechists = db.prepare('SELECT id FROM users WHERE role = ?');

  for (const [legacyRole, levelName] of Object.entries(LEGACY_ROLE_LEVELS)) {
    const level = findLevel.get(levelName);
    if (!level) {
      throw new Error(`No se encontró el nivel requerido para migrar ${legacyRole}.`);
    }

    for (const catechist of findLegacyCatechists.all(legacyRole)) {
      assignLevel.run(catechist.id, level.id);
    }
  }
}

function rebuildUsersRoleConstraint(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();

  if (!table || !/catequista_familiar|catequista_juvenil/.test(table.sql || '')) {
    return;
  }

  db.exec(`
    CREATE TABLE users_role_refactor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parish_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (
        role IN (
          'admin',
          'coordinador_zonal',
          'coordinador_parroquial',
          'catequista',
          'nino'
        )
      ),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      FOREIGN KEY (parish_id) REFERENCES parishes(id)
    );

    INSERT INTO users_role_refactor (
      id, parish_id, name, email, password_hash, role, is_active, created_at, updated_at, deleted_at
    )
    SELECT
      id,
      parish_id,
      name,
      email,
      password_hash,
      CASE
        WHEN role IN ('catequista_familiar', 'catequista_juvenil') THEN 'catequista'
        ELSE role
      END,
      is_active,
      created_at,
      updated_at,
      deleted_at
    FROM users;

    DROP TABLE users;
    ALTER TABLE users_role_refactor RENAME TO users;

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_parish_id ON users(parish_id);
  `);
}

function up(db) {
  ensureLevels(db);
  ensureCatechistLevelsTable(db);
  migrateLegacyAssignments(db);
  rebuildUsersRoleConstraint(db);

  const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyErrors.length > 0) {
    throw new Error(`La migración de roles dejó ${foreignKeyErrors.length} claves foráneas inválidas.`);
  }
}

module.exports = {
  requiresForeignKeysDisabled: true,
  up,
};
