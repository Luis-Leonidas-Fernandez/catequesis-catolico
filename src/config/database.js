const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');

const databasePath = path.resolve(process.cwd(), env.databasePath);
const databaseDirectory = path.dirname(databasePath);

fs.mkdirSync(databaseDirectory, { recursive: true });

const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

function testConnection() {
  return db.prepare('SELECT 1 AS ok').get();
}

module.exports = {
  db,
  databasePath,
  testConnection,
};
