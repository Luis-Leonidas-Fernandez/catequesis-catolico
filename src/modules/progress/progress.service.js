const progressRepository = require('./progress.repository');
const { ROLES } = require('../auth/roles');

function toPercent(completed, total) {
  if (!total) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

function toStars(percentage) {
  return Math.max(0, Math.min(5, Math.round(percentage / 20)));
}

function toProgressClass(percentage) {
  const bucket = Math.max(0, Math.min(100, Math.round(percentage / 10) * 10));
  return `progress-width-${bucket}`;
}

function getMotivation(percentage) {
  if (percentage >= 100) {
    return '¡Terminaste todas las actividades disponibles! Seguí compartiendo esa alegría.';
  }

  if (percentage >= 70) {
    return 'Vas muy bien. Un pasito más y completás el camino.';
  }

  if (percentage >= 35) {
    return 'Buen avance. Seguí practicando, cada respuesta te ayuda a crecer.';
  }

  return 'Empezá tranquilo. Lo importante es animarse y volver a intentar.';
}

function decorateProgress(row) {
  const percentage = toPercent(row.completed_activities, row.available_activities);

  return {
    ...row,
    percentage,
    progressClass: toProgressClass(percentage),
    stars: toStars(percentage),
    motivation: getMotivation(percentage),
  };
}

function getChildProgress(childId) {
  const summary = progressRepository.getChildProgress(childId);

  if (!summary) {
    return null;
  }

  return {
    summary: decorateProgress(summary),
    completedActivities: progressRepository.listChildCompletedActivities(childId),
  };
}

function canViewGroupProgress(user) {
  return (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.COORDINADOR_ZONAL ||
    user.role === ROLES.COORDINADOR_PARROQUIAL ||
    user.role === ROLES.CATEQUISTA_FAMILIAR ||
    user.role === ROLES.CATEQUISTA_JUVENIL
  );
}

function getGroupProgress(user) {
  if (!canViewGroupProgress(user)) {
    return {
      groups: [],
      children: [],
    };
  }

  const groups = progressRepository.listGroupsForUser(user);
  const children = progressRepository.listChildrenProgressForUser(user).map(decorateProgress);
  const childrenByGroup = new Map();

  for (const group of groups) {
    childrenByGroup.set(group.id, []);
  }

  for (const child of children) {
    if (!childrenByGroup.has(child.group_id)) {
      childrenByGroup.set(child.group_id, []);
    }

    childrenByGroup.get(child.group_id).push(child);
  }

  const decoratedGroups = groups.map((group) => {
    const groupChildren = childrenByGroup.get(group.id) || [];
    const average = groupChildren.length
      ? Math.round(groupChildren.reduce((total, child) => total + child.percentage, 0) / groupChildren.length)
      : 0;

    return {
      ...group,
      children: groupChildren,
      average,
      progressClass: toProgressClass(average),
      stars: toStars(average),
    };
  });

  return {
    groups: decoratedGroups,
    children,
  };
}

module.exports = {
  getChildProgress,
  getGroupProgress,
};
