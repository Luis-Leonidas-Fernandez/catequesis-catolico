const assert = require('assert');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const ejs = require('ejs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'san-pedro-password-reset-'));
const databasePath = path.join(temporaryDirectory, 'catequesis.sqlite');

process.env.DATABASE_PATH = databasePath;
process.env.APP_BASE_URL = 'https://catequesis.example.test';

(async () => {
try {
  execFileSync(process.execPath, ['src/database/migrate.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_PATH: databasePath },
    stdio: 'pipe',
  });

  const { db } = require('../src/config/database');
  const authService = require('../src/modules/auth/auth.service');
  const mailService = require('../src/services/mail.service');
  const passwordHash = bcrypt.hashSync('original-password', 10);

  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'password_reset_tokens'").get());

  db.prepare("INSERT INTO parishes (name) VALUES ('Parroquia de prueba')").run();
  const userId = db.prepare(`
    INSERT INTO users (parish_id, name, email, password_hash, role)
    VALUES (1, 'Adulto de prueba', 'adulto@example.test', ?, 'catequista')
  `).run(passwordHash).lastInsertRowid;

  let sentMail;
  mailService.assertSmtpConfigured = () => {};
  mailService.sendPasswordResetEmail = async (payload) => {
    sentMail = payload;
  };

  const firstRequest = await authService.requestPasswordReset('adulto@example.test', { ip: '127.0.0.1' });
  assert.strictEqual(firstRequest.ok, true);
  assert.strictEqual(firstRequest.requested, true);
  assert.match(sentMail.resetUrl, /^https:\/\/catequesis\.example\.test\/restablecer-contrasena\?token=/);

  const firstRawToken = new URL(sentMail.resetUrl).searchParams.get('token');
  const firstStoredToken = db.prepare('SELECT token_hash, expires_at, used_at FROM password_reset_tokens').get();
  assert.strictEqual(firstStoredToken.token_hash, crypto.createHash('sha256').update(firstRawToken).digest('hex'));
  assert.notStrictEqual(firstStoredToken.token_hash, firstRawToken);
  assert.strictEqual(firstStoredToken.used_at, null);
  assert.ok(new Date(`${firstStoredToken.expires_at.replace(' ', 'T')}Z`) <= new Date(Date.now() + (16 * 60 * 1000)));

  const secondRequest = await authService.requestPasswordReset('adulto@example.test', { ip: '127.0.0.1' });
  assert.strictEqual(secondRequest.ok, true);
  const secondRawToken = new URL(sentMail.resetUrl).searchParams.get('token');
  assert.notStrictEqual(firstRawToken, secondRawToken);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM password_reset_tokens WHERE used_at IS NULL').get().count, 1);

  const unknownRequest = await authService.requestPasswordReset('desconocido@example.test', { ip: '127.0.0.1' });
  assert.deepStrictEqual(unknownRequest, { ok: true, requested: false });

  mailService.sendPasswordResetEmail = async () => {
    const error = new Error('SMTP send failed');
    error.code = 'SMTP_SEND_FAILED';
    throw error;
  };
  const smtpFailure = await authService.requestPasswordReset('adulto@example.test', { ip: '127.0.0.1' });
  assert.deepStrictEqual(smtpFailure, { ok: false });
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM password_reset_tokens WHERE used_at IS NULL').get().count, 0);
  mailService.sendPasswordResetEmail = async (payload) => {
    sentMail = payload;
  };
  const finalRequest = await authService.requestPasswordReset('adulto@example.test', { ip: '127.0.0.1' });
  assert.strictEqual(finalRequest.ok, true);
  const finalRawToken = new URL(sentMail.resetUrl).searchParams.get('token');

  const renderView = (viewName, data) => ejs.render(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'views', viewName), 'utf8'),
    data,
    { filename: path.join(__dirname, '..', 'src', 'views', viewName) },
  );
  const loginHtml = renderView('login.ejs', {
    title: 'Iniciar sesión',
    csrfToken: 'csrf-test-token',
    error: '',
    message: '',
    email: '',
    activeLoginMode: 'catequista',
    loginVideoUrl: '',
    loginPosterUrl: '',
  });
  const recoveryHtml = renderView('request-password-reset.ejs', {
    title: 'Recuperar contraseña',
    csrfToken: 'csrf-test-token',
    email: '',
    error: '',
    message: '',
    loginVideoUrl: '',
    loginPosterUrl: '',
  });
  const resetHtml = renderView('reset-password.ejs', {
    title: 'Restablecer contraseña',
    csrfToken: 'csrf-test-token',
    token: finalRawToken,
    error: '',
    passwordError: '',
    loginVideoUrl: '',
    loginPosterUrl: '',
  });
  assert.match(loginHtml, /href="\/recuperar-cuenta">¿Olvidaste tu contraseña\?<\/a>/);
  assert.match(recoveryHtml, /action="\/recuperar-cuenta" method="post"/);
  assert.match(recoveryHtml, /name="_csrf" value="csrf-test-token"/);
  assert.match(resetHtml, /action="\/restablecer-contrasena" method="post"/);
  assert.match(resetHtml, /name="_csrf" value="csrf-test-token"/);
  assert.match(resetHtml, new RegExp(`name="token" value="${finalRawToken}"`));

  const completedReset = await authService.resetPassword(finalRawToken, 'nueva-clave-segura', { ip: '127.0.0.1' });
  assert.ok(completedReset);
  assert.strictEqual(await bcrypt.compare('nueva-clave-segura', db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId).password_hash), true);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM password_reset_tokens WHERE used_at IS NULL').get().count, 0);
  assert.strictEqual(await authService.resetPassword(finalRawToken, 'otra-clave-segura', { ip: '127.0.0.1' }), null);
  assert.match(authService.validateNewPassword('corta'), /al menos 8 caracteres/);

  const expirationRequest = await authService.requestPasswordReset('adulto@example.test', { ip: '127.0.0.1' });
  assert.strictEqual(expirationRequest.ok, true);
  const expiredRawToken = new URL(sentMail.resetUrl).searchParams.get('token');
  db.prepare("UPDATE password_reset_tokens SET expires_at = '2000-01-01 00:00:00' WHERE used_at IS NULL").run();
  assert.strictEqual(authService.findValidPasswordResetToken(expiredRawToken), null);
  assert.strictEqual(await authService.resetPassword(expiredRawToken, 'otra-clave-segura', { ip: '127.0.0.1' }), null);

  const auditRows = db.prepare("SELECT action, metadata FROM audit_logs WHERE entity_type = 'password_reset'").all();
  const auditMetadata = auditRows.map((row) => row.metadata || '').join('\n');
  assert.ok(auditRows.some((row) => row.action === 'password_reset_requested'));
  assert.ok(auditRows.some((row) => row.action === 'password_reset_completed'));
  assert.ok(auditRows.some((row) => row.action === 'password_reset_failed'));
  assert.strictEqual(auditMetadata.includes(finalRawToken), false);
  assert.strictEqual(auditMetadata.includes('nueva-clave-segura'), false);

  console.log('Password recovery verification passed.');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
