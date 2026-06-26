const groupRepository = require('./group.repository');
const { ROLES } = require('../auth/roles');

function canManageGroups(user) {
  return user.role === ROLES.ADMIN || user.role === ROLES.COORDINADOR_PARROQUIAL;
}

function canManageParish(user, parishId) {
  if (user.role === ROLES.ADMIN) {
    return true;
  }

  return user.role === ROLES.COORDINADOR_PARROQUIAL && user.parishId === parishId;
}

function isCatechist(user) {
  return user.role === ROLES.CATEQUISTA_FAMILIAR || user.role === ROLES.CATEQUISTA_JUVENIL;
}

function canViewOwnGroups(user) {
  return isCatechist(user);
}

function getCatechistLevelName(role) {
  if (role === ROLES.CATEQUISTA_FAMILIAR) {
    return 'catequesis_familiar';
  }

  if (role === ROLES.CATEQUISTA_JUVENIL) {
    return 'catequesis_juvenil';
  }

  return null;
}

function listManageableGroups(user) {
  if (user.role === ROLES.ADMIN) {
    return groupRepository.listGroups();
  }

  if (user.role === ROLES.COORDINADOR_PARROQUIAL && user.parishId) {
    return groupRepository.listGroupsByParish(user.parishId);
  }

  return [];
}

function listOwnGroups(user) {
  if (!canViewOwnGroups(user)) {
    return [];
  }

  return groupRepository.listGroupsByCatechist(user.id);
}

function getGroupFormOptions(user) {
  const parishes = user.role === ROLES.ADMIN
    ? groupRepository.listActiveParishes()
    : groupRepository.listActiveParishes().filter((parish) => parish.id === Number(user.parishId));

  const allLevels = groupRepository.listActiveCatechesisLevels();

  if (isCatechist(user)) {
    const levelName = getCatechistLevelName(user.role);

    return {
      parishes,
      catechesisLevels: allLevels.filter((level) => level.name === levelName),
      catechists: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          parish_id: user.parishId,
        },
      ],
    };
  }

  return {
    parishes,
    catechesisLevels: allLevels,
    catechists: groupRepository.listActiveCatechists(user.role === ROLES.ADMIN ? null : user.parishId),
  };
}

function getGroupForEdit(id, user) {
  const group = groupRepository.findGroupById(id);

  if (!group) {
    return null;
  }

  if (!canManageParish(user, group.parish_id)) {
    return null;
  }

  return group;
}

function validateReferences(input, user) {
  const errors = {};
  const options = getGroupFormOptions(user);

  if (isCatechist(user) && !Number(user.parishId)) {
    errors.parishId = 'Tu usuario no tiene una parroquia asignada.';
  }

  if (!options.parishes.some((parish) => parish.id === input.parishId)) {
    errors.parishId = 'No tenés permiso para gestionar esa parroquia.';
  }

  if (!options.catechesisLevels.some((level) => level.id === input.catechesisLevelId)) {
    errors.catechesisLevelId = 'El nivel de catequesis no existe o no está activo.';
  }

  if (
    input.catechistId !== null &&
    !options.catechists.some((catechist) => catechist.id === input.catechistId)
  ) {
    errors.catechistId = 'El catequista no existe, no está activo o no pertenece a la parroquia permitida.';
  }

  return errors;
}

function buildOwnGroupInput(input, actor) {
  const options = getGroupFormOptions(actor);
  const allowedLevel = options.catechesisLevels[0];

  return {
    ...input,
    parishId: Number(actor.parishId),
    catechesisLevelId: allowedLevel ? allowedLevel.id : Number(input.catechesisLevelId),
    catechistId: actor.id,
  };
}

function createGroup(input, actor) {
  const referenceErrors = validateReferences(input, actor);

  if (Object.keys(referenceErrors).length > 0) {
    return {
      ok: false,
      errors: referenceErrors,
    };
  }

  const groupId = groupRepository.runInTransaction(() => {
    const createdGroupId = groupRepository.createGroup(input);

    groupRepository.createAuditLog({
      userId: actor.id,
      action: 'group_created',
      entityType: 'groups',
      entityId: createdGroupId,
      metadata: {
        parishId: input.parishId,
        catechesisLevelId: input.catechesisLevelId,
        catechistId: input.catechistId,
        year: input.year,
      },
    });

    return createdGroupId;
  });

  return {
    ok: true,
    groupId,
  };
}


function createOwnGroup(input, actor) {
  if (!isCatechist(actor)) {
    return {
      ok: false,
      errors: {
        catechistId: 'Solo un catequista puede crear sus propios grupos.',
      },
    };
  }

  return createGroup(buildOwnGroupInput(input, actor), actor);
}

function updateGroup(id, input, actor) {
  const group = getGroupForEdit(id, actor);

  if (!group) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const referenceErrors = validateReferences(input, actor);

  if (Object.keys(referenceErrors).length > 0) {
    return {
      ok: false,
      errors: referenceErrors,
    };
  }

  groupRepository.runInTransaction(() => {
    groupRepository.updateGroup({
      id,
      ...input,
    });

    groupRepository.createAuditLog({
      userId: actor.id,
      action: 'group_updated',
      entityType: 'groups',
      entityId: id,
      metadata: {
        parishId: input.parishId,
        catechesisLevelId: input.catechesisLevelId,
        catechistId: input.catechistId,
        year: input.year,
      },
    });
  });

  return {
    ok: true,
  };
}

function deactivateGroup(id, actor) {
  const group = getGroupForEdit(id, actor);

  if (!group) {
    return {
      ok: false,
      notFound: true,
    };
  }

  groupRepository.runInTransaction(() => {
    groupRepository.deactivateGroup(id);

    groupRepository.createAuditLog({
      userId: actor.id,
      action: 'group_deactivated',
      entityType: 'groups',
      entityId: id,
      metadata: {
        parishId: group.parish_id,
        catechistId: group.catechist_id,
      },
    });
  });

  return {
    ok: true,
  };
}

module.exports = {
  canManageGroups,
  canViewOwnGroups,
  createGroup,
  createOwnGroup,
  deactivateGroup,
  getGroupForEdit,
  getGroupFormOptions,
  listManageableGroups,
  listOwnGroups,
  updateGroup,
};
