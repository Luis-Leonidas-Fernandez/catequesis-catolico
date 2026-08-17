const bcrypt = require('bcrypt');
const userRepository = require('./user.repository');
const { MANAGEABLE_USER_ROLES, ROLES } = require('../auth/roles');
const catechistLevelService = require('../catechist-levels/catechist-level.service');

const BCRYPT_SALT_ROUNDS = 10;

function getUserFormOptions() {
  return {
    roles: MANAGEABLE_USER_ROLES,
    parishes: userRepository.listActiveParishes(),
    catechesisLevels: catechistLevelService.listAssignableLevels(),
  };
}

function getSelfRegistrationCatechistFormOptions() {
  return {
    parishes: userRepository.listActiveParishes(),
    catechesisLevels: catechistLevelService.listSelfRegistrationLevels(),
  };
}

function listUsers() {
  return userRepository.listUsers();
}

function getUserForEdit(id) {
  const user = userRepository.findUserById(id);

  return user
    ? { ...user, catechesisLevelIds: userRepository.listCatechistLevelIds(user.id) }
    : null;
}

function resolveCatechistLevelIds(input, existingUser = null) {
  if (input.role !== ROLES.CATEQUISTA) {
    return [];
  }

  if (input.hasCatechesisLevelSelection) {
    return input.catechesisLevelIds;
  }

  if (existingUser && existingUser.role === ROLES.CATEQUISTA) {
    return userRepository.listCatechistLevelIds(existingUser.id);
  }

  return catechistLevelService.listAssignableLevels().map((level) => level.id);
}

function validateCatechistLevels(levelIds) {
  return catechistLevelService.validateLevelIds(levelIds)
    ? null
    : 'Los niveles seleccionados no son válidos o ya no están activos.';
}

function validateSelfRegistrationCatechistLevels(input) {
  if (
    input.hasCatechesisLevelSelection === false
    || !Array.isArray(input.catechesisLevelIds)
    || input.catechesisLevelIds.length === 0
  ) {
    return 'Seleccioná al menos un nivel de catequesis.';
  }

  if (
    input.hasInvalidCatechesisLevelIds
    || !catechistLevelService.validateSelfRegistrationLevelIds(input.catechesisLevelIds)
  ) {
    return 'Los niveles seleccionados no son válidos o ya no están activos.';
  }

  return null;
}

function assertUniqueEmail(email, currentUserId = null) {
  const existingUser = userRepository.findUserByEmail(email);

  if (existingUser && existingUser.id !== currentUserId) {
    return 'Ya existe un usuario con ese email.';
  }

  return null;
}

async function createUser(input, actorId) {
  const emailError = assertUniqueEmail(input.email);

  if (emailError) {
    return {
      ok: false,
      errors: {
        email: emailError,
      },
    };
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const catechesisLevelIds = resolveCatechistLevelIds(input);
  const levelError = validateCatechistLevels(catechesisLevelIds);

  if (levelError) {
    return { ok: false, errors: { catechesisLevelIds: levelError } };
  }

  const userId = userRepository.runInTransaction(() => {
    const createdUserId = userRepository.createUser({
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    if (input.role === ROLES.CATEQUISTA) {
      userRepository.replaceCatechistLevels(createdUserId, catechesisLevelIds);
      userRepository.createAuditLog({
        userId: actorId,
        action: 'catechist_levels_assigned',
        entityType: 'users',
        entityId: createdUserId,
        metadata: { catechesisLevelIds, reason: 'user_created' },
      });
    }

    userRepository.createAuditLog({
      userId: actorId,
      action: 'admin_user_created',
      entityType: 'users',
      entityId: createdUserId,
      metadata: {
        email: input.email,
        role: input.role,
      },
    });

    return createdUserId;
  });

  return {
    ok: true,
    userId,
  };
}


async function createSelfRegisteredCatechist(input, metadata = {}) {
  const levelError = validateSelfRegistrationCatechistLevels(input);

  if (levelError) {
    return { ok: false, errors: { catechesisLevelIds: levelError } };
  }

  const emailError = assertUniqueEmail(input.email);

  if (emailError) {
    return {
      ok: false,
      errors: {
        email: emailError,
      },
    };
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const catechesisLevelIds = input.catechesisLevelIds.map(Number);

  const userId = userRepository.runInTransaction(() => {
    const createdUserId = userRepository.createUser({
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    userRepository.replaceCatechistLevels(createdUserId, catechesisLevelIds);
    userRepository.createAuditLog({
      userId: null,
      action: 'catechist_levels_assigned',
      entityType: 'users',
      entityId: createdUserId,
      metadata: { catechesisLevelIds, reason: 'self_registration' },
    });

    userRepository.createAuditLog({
      userId: null,
      action: 'catechist_self_registered',
      entityType: 'users',
      entityId: createdUserId,
      metadata: {
        email: input.email,
        role: input.role,
        parishId: input.parishId,
        ...metadata,
      },
    });

    return createdUserId;
  });

  return {
    ok: true,
    userId,
  };
}

async function updateUser(id, input, actorId) {
  const user = userRepository.findUserById(id);

  if (!user) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const emailError = assertUniqueEmail(input.email, id);

  if (emailError) {
    return {
      ok: false,
      errors: {
        email: emailError,
      },
    };
  }

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS)
    : null;

  const catechesisLevelIds = resolveCatechistLevelIds(input, user);
  const levelError = validateCatechistLevels(catechesisLevelIds);

  if (levelError) {
    return { ok: false, errors: { catechesisLevelIds: levelError } };
  }

  const previousLevelIds = userRepository.listCatechistLevelIds(id);

  userRepository.runInTransaction(() => {
    userRepository.updateUser({
      id,
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    if (user.role === ROLES.CATEQUISTA || input.role === ROLES.CATEQUISTA) {
      userRepository.replaceCatechistLevels(id, catechesisLevelIds);

      if (previousLevelIds.join(',') !== catechesisLevelIds.join(',')) {
        userRepository.createAuditLog({
          userId: actorId,
          action: 'catechist_levels_assigned',
          entityType: 'users',
          entityId: id,
          metadata: {
            previousLevelIds,
            catechesisLevelIds,
            reason: 'user_updated',
          },
        });
      }
    }

    userRepository.createAuditLog({
      userId: actorId,
      action: 'admin_user_updated',
      entityType: 'users',
      entityId: id,
      metadata: {
        email: input.email,
        role: input.role,
        passwordChanged: Boolean(passwordHash),
      },
    });
  });

  return {
    ok: true,
  };
}

function deactivateUser(id, actorId) {
  const user = userRepository.findUserById(id);

  if (!user) {
    return {
      ok: false,
      notFound: true,
    };
  }

  if (user.id === actorId) {
    return {
      ok: false,
      errors: {
        user: 'No podés desactivar tu propio usuario mientras estás logueado.',
      },
    };
  }

  userRepository.runInTransaction(() => {
    userRepository.deactivateUser(id);

    userRepository.createAuditLog({
      userId: actorId,
      action: 'admin_user_deactivated',
      entityType: 'users',
      entityId: id,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });
  });

  return {
    ok: true,
  };
}

function activateUser(id, actorId) {
  const user = userRepository.findUserById(id);

  if (!user) {
    return {
      ok: false,
      notFound: true,
    };
  }

  if (!MANAGEABLE_USER_ROLES.includes(user.role)) {
    return {
      ok: false,
      errors: {
        user: 'El usuario seleccionado no es administrable desde este listado.',
      },
    };
  }

  if (user.is_active) {
    return {
      ok: false,
      errors: {
        user: 'El usuario ya está activo.',
      },
    };
  }

  const activated = userRepository.runInTransaction(() => {
    const result = userRepository.activateInactiveUser(id);

    if (result.changes === 0) {
      return false;
    }

    userRepository.createAuditLog({
      userId: actorId,
      action: 'admin_user_reactivated',
      entityType: 'users',
      entityId: id,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    return true;
  });

  if (!activated) {
    return {
      ok: false,
      errors: {
        user: 'El usuario ya está activo.',
      },
    };
  }

  return {
    ok: true,
  };
}

module.exports = {
  activateUser,
  createUser,
  createSelfRegisteredCatechist,
  deactivateUser,
  getUserForEdit,
  getSelfRegistrationCatechistFormOptions,
  getUserFormOptions,
  listUsers,
  updateUser,
};
