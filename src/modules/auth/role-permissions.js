const { ROLES, USER_ROLES } = require('./roles');

function isPortalUser(user) {
  return Boolean(user && USER_ROLES.includes(user.role));
}

function isAdmin(user) {
  return Boolean(user && user.role === ROLES.ADMIN);
}

function isCatechist(user) {
  return Boolean(user && user.role === ROLES.CATEQUISTA);
}

function isCoordinator(user) {
  return Boolean(
    user && [ROLES.COORDINADOR_ZONAL, ROLES.COORDINADOR_PARROQUIAL].includes(user.role),
  );
}

function canUploadGuide(user) {
  return isAdmin(user) || isCoordinator(user) || isCatechist(user);
}

module.exports = {
  canUploadGuide,
  isAdmin,
  isCatechist,
  isCoordinator,
  isPortalUser,
};
