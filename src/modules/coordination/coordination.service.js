const childRepository = require('../children/child.repository');
const groupRepository = require('../groups/group.repository');
const userRepository = require('../users/user.repository');

function ensureCoordinatorParish(user) {
  return user.parishId || 0;
}

function listParishGroups(user) {
  return groupRepository.listGroupsByParish(ensureCoordinatorParish(user));
}

function listParishChildren(user) {
  return childRepository.listChildrenByParish(ensureCoordinatorParish(user));
}

function listParishCatechists(user) {
  return userRepository.listCatechistsByParish(ensureCoordinatorParish(user));
}

module.exports = {
  listParishCatechists,
  listParishChildren,
  listParishGroups,
};
