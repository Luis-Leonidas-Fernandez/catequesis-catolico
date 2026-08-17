const { isAdmin, isCatechist } = require('../auth/role-permissions');
const catechistLevelService = require('../catechist-levels/catechist-level.service');

function getAllowedLevels(user) {
  return catechistLevelService.getAllowedLevels(user);
}

function canManageActivities(user) {
  return isAdmin(user) || (isCatechist(user) && getAllowedLevels(user).length > 0);
}

function canManageActivityLevel(user, catechesisLevelId) {
  return isAdmin(user) || (isCatechist(user) && catechistLevelService.canAccessLevel(user, catechesisLevelId));
}

module.exports = {
  canManageActivities,
  canManageActivityLevel,
  getAllowedLevels,
};
