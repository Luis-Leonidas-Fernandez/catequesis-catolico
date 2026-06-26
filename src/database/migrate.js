const fs = require('fs');
const path = require('path');
const { db, databasePath } = require('../config/database');

const migrationsDirectory = path.join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getMigrationFiles() {
  return fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith('.js'))
    .sort();
}

function hasMigrationRun(migrationId) {
  const row = db
    .prepare('SELECT id FROM schema_migrations WHERE id = ?')
    .get(migrationId);

  return Boolean(row);
}

function runMigration(fileName) {
  const migrationPath = path.join(migrationsDirectory, fileName);
  const migration = require(migrationPath);

  if (typeof migration.up !== 'function') {
    throw new Error(`La migración ${fileName} no exporta una función up(db).`);
  }

  const execute = db.transaction(() => {
    migration.up(db);

    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(fileName);
  });

  execute();
}

function runMigrations() {
  ensureMigrationsTable();

  const migrationFiles = getMigrationFiles();
  const executed = [];
  const skipped = [];

  for (const fileName of migrationFiles) {
    if (hasMigrationRun(fileName)) {
      skipped.push(fileName);
      continue;
    }

    runMigration(fileName);
    executed.push(fileName);
  }

  return {
    databasePath,
    executed,
    skipped,
  };
}

if (require.main === module) {
  const result = runMigrations();

  console.log(`Base de datos: ${result.databasePath}`);
  console.log(`Migraciones ejecutadas: ${result.executed.length}`);

  for (const migration of result.executed) {
    console.log(`- ${migration}`);
  }

  if (result.skipped.length > 0) {
    console.log(`Migraciones ya aplicadas: ${result.skipped.length}`);
  }
}

module.exports = {
  runMigrations,
};
