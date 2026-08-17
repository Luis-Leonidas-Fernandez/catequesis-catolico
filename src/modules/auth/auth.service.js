const bcrypt = require('bcrypt');
const crypto = require('crypto');
const env = require('../../config/env');
const authRepository = require('./auth.repository');
const { isPortalUser } = require('./role-permissions');
const mailService = require('../../services/mail.service');
const { validateCreateUser } = require('../users/user.validators');

const BCRYPT_SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

function sanitizeUser(user) {
  return {
    id: user.id,
    parishId: user.parish_id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function authenticateUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = authRepository.findActiveUserByEmail(normalizedEmail);

  if (!user || !isPortalUser(user)) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password || '', user.password_hash);

  if (!passwordMatches) {
    return null;
  }

  return sanitizeUser(user);
}

function getSessionUser(userId) {
  const user = authRepository.findActiveUserById(userId);

  if (!user || !isPortalUser(user)) {
    return null;
  }

  return sanitizeUser(user);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function buildPasswordResetUrl(token) {
  const baseUrl = env.appBaseUrl.replace(/\/$/, '');
  return `${baseUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
}

function logPasswordResetEvent({ action, userId = null, entityId = null, ip, reason }) {
  authRepository.createAuditLog({
    userId,
    action,
    entityType: 'password_reset',
    entityId,
    metadata: {
      ip,
      ...(reason ? { reason } : {}),
    },
  });
}

function findValidPasswordResetToken(token) {
  const safeToken = String(token || '').trim();

  if (!safeToken) {
    return null;
  }

  const resetToken = authRepository.findValidPasswordResetToken(hashToken(safeToken));

  return resetToken && isPortalUser(resetToken) ? resetToken : null;
}

function validateNewPassword(password) {
  return validateCreateUser({ password }).errors.password || null;
}

async function requestPasswordReset(email, { ip } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = authRepository.findPasswordResetUserByEmail(normalizedEmail);

  if (!user || !isPortalUser(user)) {
    logPasswordResetEvent({
      action: 'password_reset_request_unknown',
      ip,
    });

    return { ok: true, requested: false };
  }

  try {
    mailService.assertSmtpConfigured();

    const token = createToken();
    const tokenHash = hashToken(token);
    const expiresAt = toSqlDateTime(new Date(Date.now() + PASSWORD_RESET_TTL_MS));

    authRepository.runInTransaction(() => {
      authRepository.invalidateUnusedPasswordResetTokens(user.id);
      authRepository.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });
      logPasswordResetEvent({
        action: 'password_reset_requested',
        userId: user.id,
        ip,
      });
    });

    await mailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl: buildPasswordResetUrl(token),
      expiresAt,
    });

    return { ok: true, requested: true };
  } catch (error) {
    authRepository.runInTransaction(() => {
      authRepository.invalidateUnusedPasswordResetTokens(user.id);
      logPasswordResetEvent({
        action: 'password_reset_request_failed',
        userId: user.id,
        ip,
        reason: error.code === 'SMTP_NOT_CONFIGURED' ? 'smtp_not_configured' : 'smtp_send_failed',
      });
    });

    return { ok: false };
  }
}

function recordPasswordResetFailure({ userId = null, ip, reason }) {
  logPasswordResetEvent({
    action: 'password_reset_failed',
    userId,
    ip,
    reason,
  });
}

async function resetPassword(token, password, { ip } = {}) {
  const tokenHash = hashToken(String(token || '').trim());
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  return authRepository.runInTransaction(() => {
    const resetToken = authRepository.findValidPasswordResetToken(tokenHash);

    if (!resetToken || !isPortalUser(resetToken)) {
      logPasswordResetEvent({
        action: 'password_reset_failed',
        ip,
        reason: 'invalid_or_expired_token',
      });
      return null;
    }

    authRepository.updateUserPassword(resetToken.user_id, passwordHash);
    authRepository.invalidateUnusedPasswordResetTokens(resetToken.user_id);
    logPasswordResetEvent({
      action: 'password_reset_completed',
      userId: resetToken.user_id,
      entityId: resetToken.id,
      ip,
    });

    return resetToken;
  });
}

module.exports = {
  authenticateUser,
  findValidPasswordResetToken,
  getSessionUser,
  recordPasswordResetFailure,
  requestPasswordReset,
  resetPassword,
  validateNewPassword,
};
