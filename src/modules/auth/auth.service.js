const bcrypt = require('bcrypt');
const authRepository = require('./auth.repository');
const { ADMINISTRATIVE_ROLES } = require('./roles');

function sanitizeUser(user) {
  return {
    id: user.id,
    parishId: user.parish_id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function isAdministrativeUser(user) {
  return ADMINISTRATIVE_ROLES.includes(user.role);
}

async function authenticateUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = authRepository.findActiveUserByEmail(normalizedEmail);

  if (!user || !isAdministrativeUser(user)) {
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

  if (!user || !isAdministrativeUser(user)) {
    return null;
  }

  return sanitizeUser(user);
}

module.exports = {
  authenticateUser,
  getSessionUser,
};
