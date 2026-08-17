const assert = require('assert');
const { db } = require('../src/config/database');

const REQUIRED_ROLES = [
  'admin',
  'coordinador_zonal',
  'coordinador_parroquial',
  'catequista',
  'nino',
];
const REQUIRED_LEVELS = [
  'catequesis_familiar',
  'catequesis_juvenil',
  'catequesis_bautismal',
];

function verify() {
  const migration = db
    .prepare('SELECT id FROM schema_migrations WHERE id = ?')
    .get('010_role_level_refactor.js');
  assert(migration, 'La migración 010_role_level_refactor.js no fue aplicada.');

  const usersTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  for (const role of REQUIRED_ROLES) {
    assert(usersTable.sql.includes(`'${role}'`), `El CHECK de users.role no permite ${role}.`);
  }
  assert(!usersTable.sql.includes('catequista_familiar'), 'El CHECK conserva el rol legacy catequista_familiar.');
  assert(!usersTable.sql.includes('catequista_juvenil'), 'El CHECK conserva el rol legacy catequista_juvenil.');

  const levels = db.prepare(`
    SELECT name
    FROM catechesis_levels
    WHERE is_active = 1 AND deleted_at IS NULL
    ORDER BY display_order ASC, name ASC
  `).all().map((row) => row.name);
  assert.deepStrictEqual(levels, REQUIRED_LEVELS, 'Los niveles activos no coinciden con los tres niveles aprobados.');

  const unassignedCatechists = db.prepare(`
    SELECT users.id
    FROM users
    WHERE users.role = 'catequista'
      AND users.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM catechist_levels WHERE catechist_levels.catechist_id = users.id
      )
  `).all();
  assert.strictEqual(unassignedCatechists.length, 0, 'Hay catequistas sin niveles asignados.');

  const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
  assert.strictEqual(foreignKeyErrors.length, 0, 'La base contiene claves foráneas inválidas.');

  console.log('Role/level refactor verification passed.');
}

verify();
