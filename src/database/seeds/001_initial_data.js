const bcrypt = require('bcrypt');
const env = require('../../config/env');

const BCRYPT_SALT_ROUNDS = 10;

function getAdminCredentials() {
  if (env.isDefaultAdminEmail || env.isDefaultAdminPassword) {
    console.warn(
      'ADVERTENCIA: usando credenciales de desarrollo para el admin inicial. Configurá ADMIN_EMAIL y ADMIN_PASSWORD en .env.',
    );
  }

  return {
    email: env.adminEmail,
    password: env.adminPassword,
  };
}

function createParish(db) {
  const existingParish = db
    .prepare('SELECT id FROM parishes WHERE name = ? AND deleted_at IS NULL')
    .get('San Pedro');

  if (existingParish) {
    return existingParish.id;
  }

  const result = db
    .prepare(
      `
        INSERT INTO parishes (name)
        VALUES (?)
      `,
    )
    .run('San Pedro');

  return result.lastInsertRowid;
}

function createCatechesisLevels(db) {
  const levels = [
    {
      name: 'catequesis_familiar',
      description: 'Nivel de catequesis familiar.',
      displayOrder: 1,
    },
    {
      name: 'catequesis_juvenil',
      description: 'Nivel de catequesis juvenil.',
      displayOrder: 2,
    },
  ];

  const findLevel = db.prepare(
    'SELECT id FROM catechesis_levels WHERE name = ? AND deleted_at IS NULL',
  );
  const insertLevel = db.prepare(
    `
      INSERT INTO catechesis_levels (name, description, display_order)
      VALUES (?, ?, ?)
    `,
  );

  for (const level of levels) {
    const existingLevel = findLevel.get(level.name);

    if (!existingLevel) {
      insertLevel.run(level.name, level.description, level.displayOrder);
    }
  }
}

function createAdminUser(db, parishId) {
  const { email, password } = getAdminCredentials();
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existingAdmin) {
    return existingAdmin.id;
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);

  const result = db
    .prepare(
      `
        INSERT INTO users (parish_id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(parishId, 'Administrador San Pedro', email, passwordHash, 'admin');

  return result.lastInsertRowid;
}

function run(db) {
  const parishId = createParish(db);

  createCatechesisLevels(db);
  createAdminUser(db, parishId);
}

module.exports = {
  run,
};
