const catechistLevelRepository = require('./catechist-level.repository');
const { isAdmin, isCatechist } = require('../auth/role-permissions');

const SELF_REGISTRATION_LEVEL_NAMES = [
  'catequesis_familiar',
  'catequesis_juvenil',
  'catequesis_bautismal',
];

function listAssignableLevels() {
  return catechistLevelRepository.listActiveLevels();
}

function listSelfRegistrationLevels() {
  return catechistLevelRepository.listActiveLevelsByNames(SELF_REGISTRATION_LEVEL_NAMES);
}

function getAllowedLevels(user) {
  if (isAdmin(user)) {
    return listAssignableLevels();
  }

  if (isCatechist(user)) {
    return catechistLevelRepository.listLevelsForCatechist(user.id);
  }

  return [];
}

function canAccessLevel(user, levelId) {
  return getAllowedLevels(user).some((level) => level.id === Number(levelId));
}

function validateLevelIds(levelIds) {
  const normalizedIds = [...new Set(levelIds.map(Number))];
  const validIds = new Set(listAssignableLevels().map((level) => level.id));

  return normalizedIds.length === levelIds.length && normalizedIds.every((id) => validIds.has(id));
}

function validateSelfRegistrationLevelIds(levelIds) {
  if (!Array.isArray(levelIds) || levelIds.length === 0) {
    return false;
  }

  const normalizedIds = levelIds.map((levelId) => {
    if (typeof levelId === 'number') {
      return levelId;
    }

    return typeof levelId === 'string' && /^\d+$/.test(levelId.trim())
      ? Number(levelId)
      : NaN;
  });
  const allowedIds = new Set(listSelfRegistrationLevels().map((level) => level.id));

  return normalizedIds.every(Number.isInteger)
    && new Set(normalizedIds).size === normalizedIds.length
    && normalizedIds.every((id) => allowedIds.has(id));
}

function replaceLevels(catechistId, levelIds) {
  if (!validateLevelIds(levelIds)) {
    return false;
  }

  catechistLevelRepository.replaceLevelsForCatechist(catechistId, levelIds);
  return true;
}

module.exports = {
  canAccessLevel,
  getAllowedLevels,
  listAssignableLevels,
  listSelfRegistrationLevels,
  replaceLevels,
  validateLevelIds,
  validateSelfRegistrationLevelIds,
};
