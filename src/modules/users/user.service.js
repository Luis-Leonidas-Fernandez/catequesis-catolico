const bcrypt = require('bcrypt');
const userRepository = require('./user.repository');
const { ADMINISTRATIVE_ROLES } = require('../auth/roles');

const BCRYPT_SALT_ROUNDS = 10;

function getUserFormOptions() {
  return {
    roles: ADMINISTRATIVE_ROLES,
    parishes: userRepository.listActiveParishes(),
  };
}

function listUsers() {
  return userRepository.listUsers();
}

function getUserForEdit(id) {
  return userRepository.findUserById(id);
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

  const userId = userRepository.runInTransaction(() => {
    const createdUserId = userRepository.createUser({
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

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

  const userId = userRepository.runInTransaction(() => {
    const createdUserId = userRepository.createUser({
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
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

  userRepository.runInTransaction(() => {
    userRepository.updateUser({
      id,
      parishId: input.parishId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

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

module.exports = {
  createUser,
  createSelfRegisteredCatechist,
  deactivateUser,
  getUserForEdit,
  getUserFormOptions,
  listUsers,
  updateUser,
};
