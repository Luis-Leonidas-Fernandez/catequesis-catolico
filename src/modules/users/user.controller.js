const userService = require('./user.service');
const { validateCreateUser, validateUpdateUser } = require('./user.validators');
const escapeHtml = require('../../utils/escape-html');

function buildFormViewModel(overrides = {}) {
  return {
    errors: {},
    user: {
      name: '',
      email: '',
      role: '',
      parishId: '',
    },
    ...userService.getUserFormOptions(),
    ...overrides,
  };
}

function showUsers(req, res) {
  return res.render('admin/users/index', {
    title: 'Usuarios administrativos',
    user: res.locals.currentUser,
    users: userService.listUsers(),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

function showNewUser(req, res) {
  return res.render('admin/users/form', {
    title: 'Nuevo usuario',
    formAction: '/admin/users',
    formTitle: 'Crear usuario administrativo',
    submitLabel: 'Crear usuario',
    isEdit: false,
    csrfToken: res.locals.csrfToken,
    currentUser: res.locals.currentUser,
    escapeHtml,
    ...buildFormViewModel(),
  });
}

async function createUser(req, res, next) {
  try {
    const validation = validateCreateUser(req.body);

    if (!validation.isValid) {
      return res.status(422).render('admin/users/form', {
        title: 'Nuevo usuario',
        formAction: '/admin/users',
        formTitle: 'Crear usuario administrativo',
        submitLabel: 'Crear usuario',
        isEdit: false,
        csrfToken: res.locals.csrfToken,
        currentUser: res.locals.currentUser,
        escapeHtml,
        ...buildFormViewModel({
          errors: validation.errors,
          user: {
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role,
            parishId: validation.input.parishId || '',
          },
        }),
      });
    }

    const result = await userService.createUser(validation.input, res.locals.currentUser.id);

    if (!result.ok) {
      return res.status(422).render('admin/users/form', {
        title: 'Nuevo usuario',
        formAction: '/admin/users',
        formTitle: 'Crear usuario administrativo',
        submitLabel: 'Crear usuario',
        isEdit: false,
        csrfToken: res.locals.csrfToken,
        currentUser: res.locals.currentUser,
        escapeHtml,
        ...buildFormViewModel({
          errors: result.errors,
          user: {
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role,
            parishId: validation.input.parishId || '',
          },
        }),
      });
    }

    return res.redirect('/admin/users?message=Usuario%20creado');
  } catch (error) {
    return next(error);
  }
}

function showEditUser(req, res, next) {
  const user = userService.getUserForEdit(Number(req.params.id));

  if (!user) {
    return next();
  }

  return res.render('admin/users/form', {
    title: 'Editar usuario',
    formAction: `/admin/users/${user.id}`,
    formTitle: 'Editar usuario administrativo',
    submitLabel: 'Guardar cambios',
    isEdit: true,
    csrfToken: res.locals.csrfToken,
    currentUser: res.locals.currentUser,
    escapeHtml,
    ...buildFormViewModel({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        parishId: user.parish_id || '',
      },
    }),
  });
}

async function updateUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const validation = validateUpdateUser(req.body);

    if (!validation.isValid) {
      return res.status(422).render('admin/users/form', {
        title: 'Editar usuario',
        formAction: `/admin/users/${userId}`,
        formTitle: 'Editar usuario administrativo',
        submitLabel: 'Guardar cambios',
        isEdit: true,
        csrfToken: res.locals.csrfToken,
        currentUser: res.locals.currentUser,
        escapeHtml,
        ...buildFormViewModel({
          errors: validation.errors,
          user: {
            id: userId,
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role,
            parishId: validation.input.parishId || '',
          },
        }),
      });
    }

    const result = await userService.updateUser(
      userId,
      validation.input,
      res.locals.currentUser.id,
    );

    if (result.notFound) {
      return next();
    }

    if (!result.ok) {
      return res.status(422).render('admin/users/form', {
        title: 'Editar usuario',
        formAction: `/admin/users/${userId}`,
        formTitle: 'Editar usuario administrativo',
        submitLabel: 'Guardar cambios',
        isEdit: true,
        csrfToken: res.locals.csrfToken,
        currentUser: res.locals.currentUser,
        escapeHtml,
        ...buildFormViewModel({
          errors: result.errors,
          user: {
            id: userId,
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role,
            parishId: validation.input.parishId || '',
          },
        }),
      });
    }

    return res.redirect('/admin/users?message=Usuario%20actualizado');
  } catch (error) {
    return next(error);
  }
}

function deactivateUser(req, res, next) {
  const result = userService.deactivateUser(Number(req.params.id), res.locals.currentUser.id);

  if (result.notFound) {
    return next();
  }

  if (!result.ok) {
    return res.redirect(`/admin/users?error=${encodeURIComponent(result.errors.user)}`);
  }

  return res.redirect('/admin/users?message=Usuario%20desactivado');
}

module.exports = {
  createUser,
  deactivateUser,
  showEditUser,
  showNewUser,
  showUsers,
  updateUser,
};
