const fs = require('fs');
const path = require('path');
const { db, databasePath } = require('../config/database');
const { runMigrations } = require('./migrate');

const seedsDirectory = path.join(__dirname, 'seeds');

function ensureSeedsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seed_migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getSeedFiles() {
  return fs
    .readdirSync(seedsDirectory)
    .filter((fileName) => fileName.endsWith('.js'))
    .sort();
}

function hasSeedRun(seedId) {
  const row = db.prepare('SELECT id FROM seed_migrations WHERE id = ?').get(seedId);

  return Boolean(row);
}

function runSeed(fileName) {
  const seedPath = path.join(seedsDirectory, fileName);
  const seed = require(seedPath);

  if (typeof seed.run !== 'function') {
    throw new Error(`El seed ${fileName} no exporta una función run(db).`);
  }

  const execute = db.transaction(() => {
    seed.run(db);

    db.prepare('INSERT INTO seed_migrations (id) VALUES (?)').run(fileName);
  });

  execute();
}

function runSeeds() {
  runMigrations();
  ensureSeedsTable();

  const seedFiles = getSeedFiles();
  const executed = [];
  const skipped = [];

  for (const fileName of seedFiles) {
    if (hasSeedRun(fileName)) {
      skipped.push(fileName);
      continue;
    }

    runSeed(fileName);
    executed.push(fileName);
  }

  return {
    databasePath,
    executed,
    skipped,
  };
}

if (require.main === module) {
  const result = runSeeds();

  console.log(`Base de datos: ${result.databasePath}`);
  console.log(`Seeds ejecutados: ${result.executed.length}`);

  for (const seed of result.executed) {
    console.log(`- ${seed}`);
  }

  if (result.skipped.length > 0) {
    console.log(`Seeds ya aplicados: ${result.skipped.length}`);
  }
}

module.exports = {
  runSeeds,
};
