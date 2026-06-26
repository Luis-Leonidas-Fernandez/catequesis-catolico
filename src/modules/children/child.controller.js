const childService = require('./child.service');
const { validateChild } = require('./child.validators');
const guideService = require('../guides/guide.service');
const mediaService = require('../media/media.service');
const { ROLES } = require('../auth/roles');
const escapeHtml = require('../../utils/escape-html');
const { createAuditLog } = require('../../utils/audit-log');
const {
  CHILD_REMEMBER_COOKIE_NAME,
  getChildRememberCookieOptions,
  getClearChildRememberCookieOptions,
  parseCookieHeader,
} = require('./remember-device');

function buildFormViewModel(currentUser, overrides = {}) {
  return {
    errors: {},
    child: {
      firstName: '',
      lastName: '',
      avatarPath: '',
      groupId: '',
    },
    groups: childService.getAvailableGroups(currentUser),
    ...overrides,
  };
}

function showChildren(req, res) {
  return res.render('admin/children/index', {
    title: 'Niños',
    user: res.locals.currentUser,
    children: childService.listManageableChildren(res.locals.currentUser),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

function renderNewChildForm(req, res, formAction) {
  return res.render('admin/children/form', {
    title: 'Nuevo niño',
    user: res.locals.currentUser,
    formAction,
    formTitle: 'Crear niño',
    submitLabel: 'Crear niño',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(res.locals.currentUser),
  });
}

function showNewChild(req, res) {
  return renderNewChildForm(req, res, '/admin/children');
}

function showNewMyChild(req, res) {
  return renderNewChildForm(req, res, '/children/my');
}

function renderFormWithErrors(res, status, config, currentUser, validation, resultErrors = {}) {
  return res.status(status).render('admin/children/form', {
    title: config.title,
    user: currentUser,
    formAction: config.formAction,
    formTitle: config.formTitle,
    submitLabel: config.submitLabel,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(currentUser, {
      errors: {
        ...validation.errors,
        ...resultErrors,
      },
      child: {
        id: config.childId,
        firstName: validation.input.firstName,
        lastName: validation.input.lastName,
        avatarPath: validation.input.avatarPath || '',
        groupId: validation.input.groupId || '',
      },
    }),
  });
}

async function createChildWithConfig(req, res, next, config) {
  try {
    const currentUser = res.locals.currentUser;
    const validation = validateChild(req.body);

    if (!validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo niño',
          formAction: config.formAction,
          formTitle: 'Crear niño',
          submitLabel: 'Crear niño',
        },
        currentUser,
        validation,
      );
    }

    const result = await childService.createChild(validation.input, currentUser);

    if (!result.ok) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nuevo niño',
          formAction: config.formAction,
          formTitle: 'Crear niño',
          submitLabel: 'Crear niño',
        },
        currentUser,
        validation,
        result.errors,
      );
    }

    return res.render('admin/children/access-code', {
      title: 'Código de acceso',
      user: res.locals.currentUser,
      heading: 'Código generado',
      description: 'Mostralo o copialo ahora. No se volverá a mostrar en texto plano.',
      accessCode: result.accessCode,
      backHref: config.backHref,
      csrfToken: res.locals.csrfToken,
      escapeHtml,
    });
  } catch (error) {
    return next(error);
  }
}

function createChild(req, res, next) {
  return createChildWithConfig(req, res, next, {
    formAction: '/admin/children',
    backHref: '/admin/children',
  });
}

function createMyChild(req, res, next) {
  return createChildWithConfig(req, res, next, {
    formAction: '/children/my',
    backHref: '/children/my',
  });
}

function showEditChild(req, res, next) {
  const currentUser = res.locals.currentUser;
  const child = childService.getChildForEdit(Number(req.params.id), currentUser);

  if (!child) {
    return next();
  }

  return res.render('admin/children/form', {
    title: 'Editar niño',
    user: currentUser,
    formAction: `/admin/children/${child.id}`,
    formTitle: 'Editar niño',
    submitLabel: 'Guardar cambios',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(currentUser, {
      child: {
        id: child.id,
        firstName: child.first_name,
        lastName: child.last_name,
        avatarPath: child.avatar_path || '',
        groupId: child.group_id,
      },
    }),
  });
}

function updateChild(req, res, next) {
  try {
    const currentUser = res.locals.currentUser;
    const childId = Number(req.params.id);
    const validation = validateChild(req.body);

    if (!validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar niño',
          formAction: `/admin/children/${childId}`,
          formTitle: 'Editar niño',
          submitLabel: 'Guardar cambios',
          childId,
        },
        currentUser,
        validation,
      );
    }

    const result = childService.updateChild(childId, validation.input, currentUser);

    if (result.notFound) {
      return next();
    }

    if (!result.ok) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar niño',
          formAction: `/admin/children/${childId}`,
          formTitle: 'Editar niño',
          submitLabel: 'Guardar cambios',
          childId,
        },
        currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/admin/children?message=Niño%20actualizado');
  } catch (error) {
    return next(error);
  }
}

function deactivateChild(req, res, next) {
  const result = childService.deactivateChild(Number(req.params.id), res.locals.currentUser);

  if (result.notFound) {
    return next();
  }

  return res.redirect('/admin/children?message=Niño%20desactivado');
}

async function regenerateAccessCode(req, res, next) {
  try {
    const result = await childService.regenerateAccessCode(
      Number(req.params.id),
      res.locals.currentUser,
    );

    if (result.notFound) {
      return next();
    }

    return res.render('admin/children/access-code', {
      title: 'Código de acceso',
      user: res.locals.currentUser,
      heading: 'Código regenerado',
      description: 'Mostralo o copialo ahora. El código anterior dejó de servir.',
      accessCode: result.accessCode,
      backHref: res.locals.currentUser.role === 'admin' ? '/admin/children' : '/children/my',
      csrfToken: res.locals.csrfToken,
      escapeHtml,
    });
  } catch (error) {
    return next(error);
  }
}

function showMyChildren(req, res) {
  return res.render('children/my', {
    title: 'Mis niños',
    user: res.locals.currentUser,
    children: childService.listManageableChildren(res.locals.currentUser),
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showChildAccess(req, res) {
  if (req.session.childId) {
    return res.redirect('/perfil-nino');
  }

  return res.redirect('/login?mode=nino');
}

async function accessChild(req, res, next) {
  try {
    const accessCode = String(req.body.accessCode || '').trim().toUpperCase();
    const child = await childService.authenticateChild(accessCode);

    if (!child) {
      createAuditLog({
        action: 'child_access_failed',
        entityType: 'children',
        metadata: {
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
        },
      });

      return res.redirect('/login?mode=nino&child_error=invalid');
    }

    const shouldRememberDevice = req.body.rememberDevice === 'on';

    return req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }

      req.session.childId = child.id;

      if (shouldRememberDevice) {
        const rememberToken = childService.createRememberToken(child.id, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || null,
        });

        res.cookie(
          CHILD_REMEMBER_COOKIE_NAME,
          rememberToken.value,
          getChildRememberCookieOptions(),
        );
      }

      createAuditLog({
        action: 'child_access_success',
        entityType: 'children',
        entityId: child.id,
        metadata: {
          ip: req.ip,
          rememberedDevice: shouldRememberDevice,
          userAgent: req.get('user-agent') || null,
        },
      });

      return req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.redirect('/perfil-nino');
      });
    });
  } catch (error) {
    return next(error);
  }
}

function showChildProfile(req, res) {
  const currentUser = res.locals.currentUser;
  const requestedChildId = Number(req.query.childId);
  const isAdminPreview =
    currentUser &&
    currentUser.role === ROLES.ADMIN &&
    Number.isInteger(requestedChildId) &&
    requestedChildId > 0;

  if (isAdminPreview) {
    req.session.childId = requestedChildId;
  }

  if (!req.session.childId) {
    if (currentUser && currentUser.role === ROLES.ADMIN) {
      return res.redirect(
        '/admin/children?error=Seleccion%C3%A1%20un%20ni%C3%B1o%20para%20ver%20su%20perfil',
      );
    }

    return res.redirect('/acceso-nino');
  }

  const profile = childService.getChildProfile(req.session.childId);

  if (!profile) {
    delete req.session.childId;

    if (currentUser && currentUser.role === ROLES.ADMIN) {
      return res.redirect(
        '/admin/children?error=El%20perfil%20del%20ni%C3%B1o%20no%20est%C3%A1%20disponible',
      );
    }

    return res.redirect('/acceso-nino');
  }

  return res.render('child-access/profile', {
    title: 'Perfil del niño',
    profile,
    isAdminPreview,
    currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showChildActivities(req, res) {
  if (!req.session.childId) {
    return res.redirect('/acceso-nino');
  }

  const currentUser = res.locals.currentUser;
  const isAdminPreview = currentUser && currentUser.role === ROLES.ADMIN;
  const result = childService.listActivitiesForChild(req.session.childId);

  if (!result) {
    delete req.session.childId;
    return res.redirect('/acceso-nino');
  }

  return res.render('child-access/activities', {
    title: 'Actividades para niños',
    profile: result.profile,
    activities: result.activities,
    isAdminPreview,
    currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}


function showChildGuides(req, res) {
  if (!req.session.childId) {
    return res.redirect('/login?mode=nino');
  }

  const currentUser = res.locals.currentUser;
  const isAdminPreview = currentUser && currentUser.role === ROLES.ADMIN;
  const result = guideService.listGuidesForChild(req.session.childId);

  if (!result) {
    delete req.session.childId;
    return res.redirect('/login?mode=nino');
  }

  return res.render('child-access/guides', {
    title: 'Guías para niños',
    profile: result.profile,
    guides: result.guides,
    currentUser,
    isAdminPreview,
    csrfToken: res.locals.csrfToken,
    escapeHtml: require('../../utils/escape-html'),
  });
}

function downloadChildGuide(req, res, next) {
  if (!req.session.childId) {
    return res.redirect('/login?mode=nino');
  }

  const result = guideService.getGuideDownloadForChild(
    Number(req.params.id),
    req.session.childId,
  );

  if (!result) {
    return res.status(404).send('Guía no disponible.');
  }

  if (result.mediaAsset) {
    return mediaService.streamPrivateAsset(result.mediaAsset, res, `${result.guide.title}.pdf`);
  }

  return res.download(result.filePath, `${result.guide.title}.pdf`);
}

function showChildActivityGame(req, res, next) {
  if (!req.session.childId) {
    return res.redirect('/acceso-nino');
  }

  const currentUser = res.locals.currentUser;
  const isAdminPreview = currentUser && currentUser.role === ROLES.ADMIN;
  const questionIndex = Number(req.query.pregunta || 0);
  const game = childService.getActivityGame(
    req.session.childId,
    Number(req.params.id),
    Number.isInteger(questionIndex) ? questionIndex : 0,
  );

  if (!game) {
    return next();
  }

  return res.render('child-access/activity-game', {
    title: game.activity.title,
    game,
    isAdminPreview,
    currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function answerChildActivityQuestion(req, res, next) {
  if (!req.session.childId) {
    return res.redirect('/acceso-nino');
  }

  const result = childService.evaluateActivityAnswer(
    req.session.childId,
    Number(req.params.id),
    req.body,
  );

  if (result.notFound || !result.game) {
    return next();
  }

  const currentUser = res.locals.currentUser;
  const isAdminPreview = currentUser && currentUser.role === ROLES.ADMIN;

  return res.status(result.ok ? 200 : 422).render('child-access/activity-game', {
    title: result.game.activity.title,
    game: result.game,
    isAdminPreview,
    currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function exitChild(req, res, next) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const rememberCookie = cookies[CHILD_REMEMBER_COOKIE_NAME];

  if (rememberCookie) {
    childService.revokeRememberToken(rememberCookie);
  }

  res.clearCookie(CHILD_REMEMBER_COOKIE_NAME, getClearChildRememberCookieOptions());
  delete req.session.childId;

  return req.session.save((error) => {
    if (error) {
      return next(error);
    }

    return res.redirect('/acceso-nino');
  });
}

module.exports = {
  answerChildActivityQuestion,
  accessChild,
  createChild,
  createMyChild,
  deactivateChild,
  exitChild,
  regenerateAccessCode,
  showChildAccess,
  downloadChildGuide,
  showChildActivities,
  showChildGuides,
  showChildActivityGame,
  showChildren,
  showEditChild,
  showChildProfile,
  showMyChildren,
  showNewChild,
  showNewMyChild,
  updateChild,
};
