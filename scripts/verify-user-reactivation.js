const assert = require('assert');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'san-pedro-user-reactivation-'));
const databasePath = path.join(temporaryDirectory, 'catequesis.sqlite');

process.env.DATABASE_PATH = databasePath;
process.env.APP_BASE_URL = 'https://catequesis.example.test';

async function verify() {
  try {
    execFileSync(process.execPath, ['src/database/migrate.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_PATH: databasePath },
      stdio: 'pipe',
    });

    const { db } = require('../src/config/database');
    const userService = require('../src/modules/users/user.service');
    const userRepository = require('../src/modules/users/user.repository');
    const authService = require('../src/modules/auth/auth.service');
    const mailService = require('../src/services/mail.service');

    const parishId = db.prepare('INSERT INTO parishes (name) VALUES (?)').run('Parroquia de prueba').lastInsertRowid;
    const levelId = db.prepare('SELECT id FROM catechesis_levels ORDER BY id ASC LIMIT 1').get().id;
    const passwordHash = bcrypt.hashSync('clave-segura', 10);
    const actorId = db.prepare(`
      INSERT INTO users (parish_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(parishId, 'Administrador de prueba', 'admin@example.test', passwordHash).lastInsertRowid;
    const userId = db.prepare(`
      INSERT INTO users (parish_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 'catequista', 0)
    `).run(parishId, 'Catequista inactivo', 'catequista@example.test', passwordHash).lastInsertRowid;

    db.prepare('INSERT INTO catechist_levels (catechist_id, catechesis_level_id) VALUES (?, ?)').run(userId, levelId);
    const groupId = db.prepare(`
      INSERT INTO groups (parish_id, catechesis_level_id, catechist_id, name, year)
      VALUES (?, ?, ?, ?, ?)
    `).run(parishId, levelId, userId, 'Grupo de prueba', 2026).lastInsertRowid;
    const childId = db.prepare(`
      INSERT INTO children (group_id, parish_id, catechesis_level_id, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(groupId, parishId, levelId, 'Niña', 'De prueba').lastInsertRowid;
    const activityId = db.prepare(`
      INSERT INTO activities (catechesis_level_id, title, description)
      VALUES (?, ?, ?)
    `).run(levelId, 'Actividad de prueba', 'Historial existente').lastInsertRowid;
    db.prepare(`
      INSERT INTO activity_attempts (activity_id, child_id, score, total_questions)
      VALUES (?, ?, ?, ?)
    `).run(activityId, childId, 8, 10);
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(actorId, 'existing_user_history', 'users', userId, JSON.stringify({ preserved: true }));

    const beforeUser = db.prepare(`
      SELECT parish_id, email, password_hash, role, is_active
      FROM users
      WHERE id = ?
    `).get(userId);
    const beforeLevels = db.prepare('SELECT catechesis_level_id FROM catechist_levels WHERE catechist_id = ?').all(userId);
    const beforeGroups = db.prepare('SELECT id, catechist_id FROM groups WHERE catechist_id = ?').all(userId);
    const beforeChildren = db.prepare('SELECT id, group_id FROM children WHERE group_id = ?').all(groupId);
    const beforeAttempts = db.prepare('SELECT id, activity_id, child_id, score FROM activity_attempts WHERE child_id = ?').all(childId);
    const beforeAuditLogs = db.prepare('SELECT action, metadata FROM audit_logs WHERE entity_id = ? ORDER BY id').all(userId);

    assert.strictEqual(await authService.authenticateUser('catequista@example.test', 'clave-segura'), null);
    mailService.assertSmtpConfigured = () => {};
    mailService.sendPasswordResetEmail = async () => {};
    assert.deepStrictEqual(
      await authService.requestPasswordReset('catequista@example.test', { ip: '127.0.0.1' }),
      { ok: true, requested: false },
    );

    assert.deepStrictEqual(userService.activateUser(Number(userId), Number(actorId)), { ok: true });

    const restoredUser = db.prepare(`
      SELECT parish_id, email, password_hash, role, is_active
      FROM users
      WHERE id = ?
    `).get(userId);
    assert.deepStrictEqual(restoredUser, { ...beforeUser, is_active: 1 });
    assert.deepStrictEqual(db.prepare('SELECT catechesis_level_id FROM catechist_levels WHERE catechist_id = ?').all(userId), beforeLevels);
    assert.deepStrictEqual(db.prepare('SELECT id, catechist_id FROM groups WHERE catechist_id = ?').all(userId), beforeGroups);
    assert.deepStrictEqual(db.prepare('SELECT id, group_id FROM children WHERE group_id = ?').all(groupId), beforeChildren);
    assert.deepStrictEqual(db.prepare('SELECT id, activity_id, child_id, score FROM activity_attempts WHERE child_id = ?').all(childId), beforeAttempts);

    const auditLogs = db.prepare('SELECT user_id, action, entity_type, entity_id, metadata FROM audit_logs WHERE entity_id = ? ORDER BY id').all(userId);
    assert.deepStrictEqual(auditLogs.slice(0, -1).map(({ action, metadata }) => ({ action, metadata })), beforeAuditLogs);
    assert.deepStrictEqual(auditLogs.at(-1), {
      user_id: Number(actorId),
      action: 'admin_user_reactivated',
      entity_type: 'users',
      entity_id: Number(userId),
      metadata: JSON.stringify({ email: 'catequista@example.test', role: 'catequista' }),
    });

    assert.deepStrictEqual(
      userService.activateUser(Number(userId), Number(actorId)),
      { ok: false, errors: { user: 'El usuario ya está activo.' } },
    );
    assert.strictEqual(userRepository.activateInactiveUser(Number(userId)).changes, 0);
    assert.strictEqual(
      db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'admin_user_reactivated' AND entity_id = ?").get(userId).count,
      1,
    );
    assert.deepStrictEqual(await authService.authenticateUser('catequista@example.test', 'clave-segura'), {
      id: Number(userId),
      parishId: Number(parishId),
      name: 'Catequista inactivo',
      email: 'catequista@example.test',
      role: 'catequista',
    });
    assert.deepStrictEqual(
      await authService.requestPasswordReset('catequista@example.test', { ip: '127.0.0.1' }),
      { ok: true, requested: true },
    );

    const inactiveChildUserId = db.prepare(`
      INSERT INTO users (parish_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 'nino', 0)
    `).run(parishId, 'Usuario niño', 'nino@example.test', passwordHash).lastInsertRowid;
    assert.deepStrictEqual(
      userService.activateUser(Number(inactiveChildUserId), Number(actorId)),
      { ok: false, errors: { user: 'El usuario seleccionado no es administrable desde este listado.' } },
    );
    assert.strictEqual(db.prepare('SELECT is_active FROM users WHERE id = ?').get(inactiveChildUserId).is_active, 0);

    const renderUserIndex = (users) => ejs.render(
      fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'admin', 'users', 'index.ejs'), 'utf8'),
      {
        title: 'Usuarios administrativos',
        user: { role: 'admin' },
        users,
        csrfToken: 'csrf-test-token',
        message: '',
        error: '',
        escapeHtml: require('../src/utils/escape-html'),
      },
      { filename: path.join(__dirname, '..', 'src', 'views', 'admin', 'users', 'index.ejs') },
    );
    const inactiveHtml = renderUserIndex([{ id: 42, name: 'Inactivo', email: 'inactive@example.test', role: 'catequista', parish_name: 'San Pedro', is_active: 0 }]);
    const activeHtml = renderUserIndex([{ id: 42, name: 'Activo', email: 'active@example.test', role: 'catequista', parish_name: 'San Pedro', is_active: 1 }]);
    assert.match(inactiveHtml, /Inactivo/);
    assert.match(inactiveHtml, /action="\/admin\/users\/42\/activate" method="post"/);
    assert.match(inactiveHtml, /name="_csrf" value="csrf-test-token"/);
    assert.match(inactiveHtml, /Reactivar/);
    assert.match(activeHtml, /action="\/admin\/users\/42\/deactivate" method="post"/);
    assert.match(activeHtml, /Desactivar/);

    const routesSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'users', 'user.routes.js'), 'utf8');
    assert.match(routesSource, /router\.use\('\/admin\/users', requireAuth, requireRole\(\[ROLES\.ADMIN\]\)\);/);
    assert.match(routesSource, /router\.post\('\/admin\/users\/:id\/activate', userController\.activateUser\);/);

    console.log('User reactivation verification passed.');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
