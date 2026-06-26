const groupService = require('./group.service');
const { validateGroup } = require('./group.validators');
const escapeHtml = require('../../utils/escape-html');

function buildFormViewModel(currentUser, overrides = {}) {
  const options = groupService.getGroupFormOptions(currentUser);
  const defaultParish = options.parishes.length === 1 ? options.parishes[0].id : currentUser.parishId || '';
  const defaultLevel = options.catechesisLevels.length === 1 ? options.catechesisLevels[0].id : '';
  const defaultCatechist = options.catechists.length === 1 ? options.catechists[0].id : '';

  return {
    errors: {},
    group: {
      name: '',
      parishId: defaultParish,
      catechesisLevelId: defaultLevel,
      catechistId: defaultCatechist,
      year: new Date().getFullYear(),
    },
    ...options,
    ...overrides,
  };
}

function buildOwnGroupBody(body, currentUser) {
  const options = groupService.getGroupFormOptions(currentUser);
  const allowedLevel = options.catechesisLevels[0];

  return {
    ...body,
    parishId: currentUser.parishId,
    catechesisLevelId: allowedLevel ? allowedLevel.id : body.catechesisLevelId,
    catechistId: currentUser.id,
  };
}

function showGroups(req, res) {
  return res.render('admin/groups/index', {
    title: 'Grupos de catequesis',
    user: res.locals.currentUser,
    groups: groupService.listManageableGroups(res.locals.currentUser),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

function showNewGroup(req, res) {
  return res.render('admin/groups/form', {
    title: 'Nuevo grupo',
    formAction: '/admin/groups',
    formTitle: 'Crear grupo de catequesis',
    submitLabel: 'Crear grupo',
    csrfToken: res.locals.csrfToken,
    user: res.locals.currentUser,
    escapeHtml,
    ...buildFormViewModel(res.locals.currentUser),
  });
}

function showNewMyGroup(req, res) {
  return res.render('admin/groups/form', {
    title: 'Nuevo grupo',
    formAction: '/groups/my',
    formTitle: 'Crear mi grupo',
    submitLabel: 'Crear mi grupo',
    csrfToken: res.locals.csrfToken,
    user: res.locals.currentUser,
    escapeHtml,
    ...buildFormViewModel(res.locals.currentUser),
  });
}

function renderFormWithErrors(res, status, config, currentUser, validation, resultErrors = {}) {
  return res.status(status).render('admin/groups/form', {
    title: config.title,
    formAction: config.formAction,
    formTitle: config.formTitle,
    submitLabel: config.submitLabel,
    csrfToken: res.locals.csrfToken,
    user: currentUser,
    escapeHtml,
    ...buildFormViewModel(currentUser, {
      errors: {
        ...validation.errors,
        ...resultErrors,
      },
      group: {
        id: config.groupId,
        name: validation.input.name,
        parishId: validation.input.parishId || '',
        catechesisLevelId: validation.input.catechesisLevelId || '',
        catechistId: validation.input.catechistId || '',
        year: validation.input.year || new Date().getFullYear(),
      },
    }),
  });
}

function createGroup(req, res, next) {
  try {
    const currentUser = res.locals.currentUser;
    const validation = validateGroup(req.body);

    if (!validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo grupo',
          formAction: '/admin/groups',
          formTitle: 'Crear grupo de catequesis',
          submitLabel: 'Crear grupo',
        },
        currentUser,
        validation,
      );
    }

    const result = groupService.createGroup(validation.input, currentUser);

    if (!result.ok) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo grupo',
          formAction: '/admin/groups',
          formTitle: 'Crear grupo de catequesis',
          submitLabel: 'Crear grupo',
        },
        currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/admin/groups?message=Grupo%20creado');
  } catch (error) {
    return next(error);
  }
}

function createMyGroup(req, res, next) {
  try {
    const currentUser = res.locals.currentUser;
    const validation = validateGroup(buildOwnGroupBody(req.body, currentUser));

    if (!validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo grupo',
          formAction: '/groups/my',
          formTitle: 'Crear mi grupo',
          submitLabel: 'Crear mi grupo',
        },
        currentUser,
        validation,
      );
    }

    const result = groupService.createOwnGroup(validation.input, currentUser);

    if (!result.ok) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo grupo',
          formAction: '/groups/my',
          formTitle: 'Crear mi grupo',
          submitLabel: 'Crear mi grupo',
        },
        currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/groups/my?message=Grupo%20creado');
  } catch (error) {
    return next(error);
  }
}

function showEditGroup(req, res, next) {
  const currentUser = res.locals.currentUser;
  const group = groupService.getGroupForEdit(Number(req.params.id), currentUser);

  if (!group) {
    return next();
  }

  return res.render('admin/groups/form', {
    title: 'Editar grupo',
    formAction: `/admin/groups/${group.id}`,
    formTitle: 'Editar grupo de catequesis',
    submitLabel: 'Guardar cambios',
    csrfToken: res.locals.csrfToken,
    user: res.locals.currentUser,
    escapeHtml,
    ...buildFormViewModel(currentUser, {
      group: {
        id: group.id,
        name: group.name,
        parishId: group.parish_id,
        catechesisLevelId: group.catechesis_level_id,
        catechistId: group.catechist_id || '',
        year: group.year,
      },
    }),
  });
}

function updateGroup(req, res, next) {
  try {
    const currentUser = res.locals.currentUser;
    const groupId = Number(req.params.id);
    const validation = validateGroup(req.body);

    if (!validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar grupo',
          formAction: `/admin/groups/${groupId}`,
          formTitle: 'Editar grupo de catequesis',
          submitLabel: 'Guardar cambios',
          groupId,
        },
        currentUser,
        validation,
      );
    }

    const result = groupService.updateGroup(groupId, validation.input, currentUser);

    if (result.notFound) {
      return next();
    }

    if (!result.ok) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar grupo',
          formAction: `/admin/groups/${groupId}`,
          formTitle: 'Editar grupo de catequesis',
          submitLabel: 'Guardar cambios',
          groupId,
        },
        currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/admin/groups?message=Grupo%20actualizado');
  } catch (error) {
    return next(error);
  }
}

function deactivateGroup(req, res, next) {
  const result = groupService.deactivateGroup(Number(req.params.id), res.locals.currentUser);

  if (result.notFound) {
    return next();
  }

  return res.redirect('/admin/groups?message=Grupo%20desactivado');
}

function showMyGroups(req, res) {
  return res.render('groups/my', {
    title: 'Mis grupos',
    user: res.locals.currentUser,
    groups: groupService.listOwnGroups(res.locals.currentUser),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

module.exports = {
  createGroup,
  createMyGroup,
  deactivateGroup,
  showEditGroup,
  showGroups,
  showMyGroups,
  showNewGroup,
  showNewMyGroup,
  updateGroup,
};
