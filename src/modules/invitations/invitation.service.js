const bcrypt = require('bcrypt');
const crypto = require('crypto');
const env = require('../../config/env');
const mailService = require('../../services/mail.service');
const invitationRepository = require('./invitation.repository');

const BCRYPT_SALT_ROUNDS = 10;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function isExpired(invitation) {
  return new Date(`${invitation.expires_at.replace(' ', 'T')}Z`) <= new Date();
}

function buildRegistrationUrl(token) {
  const baseUrl = env.appBaseUrl.replace(/\/$/, '');
  return `${baseUrl}/registro-coordinador?token=${encodeURIComponent(token)}`;
}

function listInvitations() {
  return invitationRepository.listInvitations().map((invitation) => ({
    ...invitation,
    status: invitation.used_at
      ? 'usada'
      : isExpired(invitation)
        ? 'vencida'
        : 'pendiente',
  }));
}

async function createInvitation(input, actor) {
  mailService.assertSmtpConfigured();

  const existingUser = invitationRepository.findUserByEmail(input.email);

  if (existingUser) {
    return {
      ok: false,
      errors: {
        email: 'Ya existe un usuario con ese email.',
      },
    };
  }

  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = toSqlDateTime(addHours(new Date(), input.expiresInHours));
  const registrationUrl = buildRegistrationUrl(token);

  const invitationId = invitationRepository.runInTransaction(() => {
    const createdInvitationId = invitationRepository.createInvitation({
      email: input.email,
      role: input.role,
      tokenHash,
      expiresAt,
      createdBy: actor.id,
    });

    invitationRepository.createAuditLog({
      userId: actor.id,
      action: 'coordinator_invitation_created',
      entityType: 'coordinator_invitations',
      entityId: createdInvitationId,
      metadata: {
        email: input.email,
        role: input.role,
        expiresAt,
      },
    });

    return createdInvitationId;
  });

  await mailService.sendCoordinatorInvitation({
    to: input.email,
    registrationUrl,
    expiresAt,
    role: input.role,
  });

  return {
    ok: true,
    invitationId,
    registrationUrl,
    expiresAt,
  };
}

function getInvitationForRegistration(token) {
  const safeToken = String(token || '').trim();

  if (!safeToken) {
    return {
      ok: false,
      error: 'El token de invitación es obligatorio.',
    };
  }

  const invitation = invitationRepository.findInvitationByTokenHash(hashToken(safeToken));

  if (!invitation) {
    return {
      ok: false,
      error: 'La invitación no existe o el token no es válido.',
    };
  }

  if (invitation.used_at) {
    return {
      ok: false,
      error: 'Esta invitación ya fue utilizada.',
    };
  }

  if (isExpired(invitation)) {
    return {
      ok: false,
      error: 'Esta invitación venció. Pedí una nueva invitación al administrador.',
    };
  }

  return {
    ok: true,
    invitation,
  };
}

async function completeCoordinatorRegistration(token, input) {
  const invitationResult = getInvitationForRegistration(token);

  if (!invitationResult.ok) {
    return invitationResult;
  }

  const invitation = invitationResult.invitation;
  const existingUser = invitationRepository.findUserByEmail(invitation.email);

  if (existingUser) {
    return {
      ok: false,
      errors: {
        email: 'Ya existe un usuario con el email invitado.',
      },
    };
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const result = invitationRepository.runInTransaction(() => {
    const existingParish = invitationRepository.findParishByName(input.parishName);
    const parishId = existingParish
      ? existingParish.id
      : invitationRepository.createParish(input.parishName);

    const userId = invitationRepository.createUser({
      parishId,
      name: input.name,
      email: invitation.email,
      passwordHash,
      role: invitation.role,
    });

    invitationRepository.markInvitationUsed({
      id: invitation.id,
      parishId,
      createdUserId: userId,
    });

    invitationRepository.createAuditLog({
      userId,
      action: 'coordinator_registered_with_invitation',
      entityType: 'users',
      entityId: userId,
      metadata: {
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        parishId,
        parishName: input.parishName,
        createdParish: !existingParish,
      },
    });

    return {
      userId,
      parishId,
    };
  });

  return {
    ok: true,
    ...result,
  };
}

module.exports = {
  completeCoordinatorRegistration,
  createInvitation,
  getInvitationForRegistration,
  listInvitations,
};
