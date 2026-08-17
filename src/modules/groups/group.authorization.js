const { ROLES } = require('../auth/roles');
const { isAdmin, isCatechist } = require('../auth/role-permissions');
const catechistLevelService = require('../catechist-levels/catechist-level.service');

function canManageParish(user, parishId) {
  return isAdmin(user) || (
    user.role === ROLES.COORDINADOR_PARROQUIAL && Number(user.parishId) === Number(parishId)
  );
}

function canManageGroup(user, group) {
  return Boolean(group && canManageParish(user, group.parish_id));
}

function canManageOwnGroups(user) {
  return isCatechist(user);
}

function canCreateOwnGroup(user, input) {
  return canManageOwnGroups(user)
    && Number(user.parishId) === Number(input.parishId)
    && Number(user.id) === Number(input.catechistId)
    && catechistLevelService.canAccessLevel(user, input.catechesisLevelId);
}

module.exports = {
  canCreateOwnGroup,
  canManageGroup,
  canManageOwnGroups,
  canManageParish,
};
