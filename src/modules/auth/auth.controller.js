const authService = require('./auth.service');
const { ROLES } = require('./roles');
const logger = require('../../config/logger');
const env = require('../../config/env');
const { createAuditLog } = require('../../utils/audit-log');
const escapeHtml = require('../../utils/escape-html');
const { getLoginMediaViewModel } = require('../../utils/login-media');
const { getDashboardCardImageUrl } = require('../../utils/dashboard-media');
const userService = require('../users/user.service');
const {
  SELF_REGISTRATION_ROLES,
  validateSelfRegisterCatechist,
} = require('../users/user.validators');

const DASHBOARD_BY_ROLE = {
  [ROLES.ADMIN]: {
    badge: 'Administrador',
    heading: 'Panel general',
    description: 'Tenés acceso a todos los espacios administrativos.',
    links: [
      { href: '/admin/dashboard', label: 'Área admin', description: 'Panel mínimo reservado para administración.' },
      { href: '/progress/groups', label: 'Progreso', description: 'Ver avance grupal e individual.' },
      { href: '/reports/progress.csv', label: 'CSV progreso', description: 'Descargar reporte de progreso.' },
      { href: '/dashboard/coordinacion', label: 'Coordinación', description: 'Espacio para coordinación zonal y parroquial.' },
      { href: '/guides', label: 'Guías', description: 'Subir y descargar guías anuales.' },
      { href: '/dashboard/catequesis', label: 'Catequistas', description: 'Espacio para catequesis familiar y juvenil.' },
    ],
  },
  [ROLES.COORDINADOR_ZONAL]: {
    badge: 'Coordinación zonal',
    heading: 'Dashboard de coordinación zonal',
    description: 'Observá el flujo de información de tu parroquia asignada.',
    links: [
      { href: '/coordinacion/grupos', label: 'Grupos', description: 'Ver grupos de tu parroquia.' },
      { href: '/coordinacion/ninos', label: 'Niños', description: 'Ver catecúmenos de tu parroquia.' },
      { href: '/coordinacion/catequistas', label: 'Catequistas', description: 'Ver catequistas de tu parroquia.' },
      { href: '/progress/groups', label: 'Progreso', description: 'Ver avance de grupos y niños de tu parroquia.' },
      { href: '/reports/progress.csv', label: 'CSV progreso', description: 'Descargar reporte según tu parroquia.' },
    ],
  },
  [ROLES.COORDINADOR_PARROQUIAL]: {
    badge: 'Coordinación parroquial',
    heading: 'Dashboard de coordinación parroquial',
    description: 'Observá grupos, niños y progreso únicamente de tu parroquia.',
    links: [
      { href: '/coordinacion/grupos', label: 'Grupos', description: 'Ver grupos de tu parroquia.' },
      { href: '/coordinacion/ninos', label: 'Niños', description: 'Ver catecúmenos de tu parroquia.' },
      { href: '/coordinacion/catequistas', label: 'Catequistas', description: 'Ver catequistas de tu parroquia.' },
      { href: '/progress/groups', label: 'Progreso', description: 'Ver avance de grupos y niños de tu parroquia.' },
      { href: '/guides', label: 'Guías', description: 'Consultar guías anuales por nivel.' },
      { href: '/reports/progress.csv', label: 'CSV progreso', description: 'Descargar reporte según tu parroquia.' },
    ],
  },
  [ROLES.CATEQUISTA]: {
    badge: 'Catequista',
    heading: 'Dashboard de catequesis',
    description: 'Gestioná tus grupos y contenidos dentro de los niveles que tenés asignados.',
    links: [
      { href: '/dashboard/catequesis', label: 'Catequistas', description: 'Entrar al espacio de catequesis.' },
      { href: '/groups/my', label: 'Mis grupos', description: 'Ver tus grupos asignados.' },
      { href: '/children/my', label: 'Mis niños', description: 'Ver niños asignados a tus grupos.' },
      { href: '/admin/activities', label: 'Actividades', description: 'Crear y gestionar actividades para tus niveles.' },
      { href: '/progress/groups', label: 'Progreso', description: 'Ver avance de tus grupos.' },
      { href: '/guides', label: 'Guías', description: 'Descargar guías anuales.' },
      { href: '/reports/progress.csv', label: 'CSV progreso', description: 'Descargar reporte de tus grupos.' },
    ],
  },
};

function showLogin(req, res) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  if (req.session.childId) {
    return res.redirect('/perfil-nino');
  }

  const isChildMode = req.query.mode === 'nino';
  const childError =
    isChildMode && req.query.child_error === 'invalid'
      ? 'El código no es válido o ya no está activo.'
      : null;

  return res.render('login', {
    title: 'Iniciar sesión',
    error: childError,
    message: req.query.message || '',
    email: '',
    activeLoginMode: isChildMode ? 'nino' : 'catequista',
    csrfToken: res.locals.csrfToken,
    ...getLoginMediaViewModel(),
  });
}

function renderPasswordRecovery(res, { email = '', error = '', message = '', status = 200 } = {}) {
  return res.status(status).render('request-password-reset', {
    title: 'Recuperar contraseña',
    csrfToken: res.locals.csrfToken,
    email,
    error,
    message,
    ...getLoginMediaViewModel(),
  });
}

function showPasswordRecovery(req, res) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  return renderPasswordRecovery(res);
}

async function requestPasswordRecovery(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();

  try {
    const result = await authService.requestPasswordReset(email, { ip: req.ip });

    if (!result.ok) {
      return renderPasswordRecovery(res, {
        email,
        status: 503,
        error: 'No pudimos procesar la solicitud en este momento. Probá nuevamente más tarde.',
      });
    }

    return renderPasswordRecovery(res, {
      message: 'Si existe una cuenta activa con ese email, te enviamos instrucciones para restablecer la contraseña.',
    });
  } catch (error) {
    return renderPasswordRecovery(res, {
      email,
      status: 503,
      error: 'No pudimos procesar la solicitud en este momento. Probá nuevamente más tarde.',
    });
  }
}

function renderPasswordReset(res, { token = '', error = '', passwordError = '', status = 200 } = {}) {
  return res.status(status).render('reset-password', {
    title: 'Restablecer contraseña',
    csrfToken: res.locals.csrfToken,
    token,
    error,
    passwordError,
    ...getLoginMediaViewModel(),
  });
}

function showPasswordReset(req, res) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  try {
    const token = String(req.query.token || '').trim();
    const resetToken = authService.findValidPasswordResetToken(token);

    if (!resetToken) {
      authService.recordPasswordResetFailure({ ip: req.ip, reason: 'invalid_or_expired_token_view' });
      return renderPasswordReset(res, {
        error: 'Este enlace no es válido o venció. Solicitá uno nuevo.',
      });
    }

    return renderPasswordReset(res, { token });
  } catch (error) {
    return renderPasswordReset(res, {
      status: 503,
      error: 'No pudimos procesar el enlace en este momento. Probá nuevamente más tarde.',
    });
  }
}

async function resetPassword(req, res) {
  try {
    const token = String(req.body.token || '').trim();
    const resetToken = authService.findValidPasswordResetToken(token);

    if (!resetToken) {
      authService.recordPasswordResetFailure({ ip: req.ip, reason: 'invalid_or_expired_token_submit' });
      return renderPasswordReset(res, {
        status: 422,
        error: 'Este enlace no es válido o venció. Solicitá uno nuevo.',
      });
    }

    const passwordError = authService.validateNewPassword(req.body.password);

    if (passwordError) {
      authService.recordPasswordResetFailure({
        userId: resetToken.user_id,
        ip: req.ip,
        reason: 'password_validation_failed',
      });
      return renderPasswordReset(res, {
        token,
        status: 422,
        passwordError,
      });
    }

    const completedReset = await authService.resetPassword(token, req.body.password, { ip: req.ip });

    if (!completedReset) {
      return renderPasswordReset(res, {
        status: 422,
        error: 'Este enlace no es válido o venció. Solicitá uno nuevo.',
      });
    }

    return res.redirect('/login?message=Contrase%C3%B1a%20actualizada.%20Inici%C3%A1%20sesi%C3%B3n%20con%20tu%20nueva%20contrase%C3%B1a.');
  } catch (error) {
    return renderPasswordReset(res, {
      status: 503,
      error: 'No pudimos actualizar la contraseña en este momento. Probá nuevamente más tarde.',
    });
  }
}

function showSplash(req, res) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  if (req.session.childId) {
    return res.redirect('/perfil-nino');
  }

  const refreshDelaySeconds = Math.max(1, Math.ceil(env.splashMaxDelayMs / 1000));
  res.set('Refresh', `${refreshDelaySeconds}; url=/login`);

  return res.render('splash', {
    title: 'Bienvenido',
    minDelayMs: env.splashMinDelayMs,
    maxDelayMs: env.splashMaxDelayMs,
    ...getLoginMediaViewModel(),
  });
}


function buildRegisterViewModel(overrides = {}) {
  const options = userService.getSelfRegistrationCatechistFormOptions();

  return {
    errors: {},
    form: {
      name: '',
      email: '',
      role: ROLES.CATEQUISTA,
      parishId: '',
      catechesisLevelIds: [],
    },
    roles: SELF_REGISTRATION_ROLES,
    parishes: options.parishes,
    catechesisLevels: options.catechesisLevels,
    ...overrides,
  };
}

function showCatechistRegister(req, res) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  return res.render('register-catechist', {
    title: 'Registro de catequista',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...getLoginMediaViewModel(),
    ...buildRegisterViewModel(),
  });
}

async function registerCatechist(req, res, next) {
  try {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }

    const validation = validateSelfRegisterCatechist(req.body);

    if (!validation.isValid) {
      return res.status(422).render('register-catechist', {
        title: 'Registro de catequista',
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...getLoginMediaViewModel(),
        ...buildRegisterViewModel({
          errors: validation.errors,
          form: {
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role || ROLES.CATEQUISTA,
            parishId: validation.input.parishId || '',
            catechesisLevelIds: validation.input.catechesisLevelIds,
          },
        }),
      });
    }

    const result = await userService.createSelfRegisteredCatechist(validation.input, { ip: req.ip });

    if (!result.ok) {
      return res.status(422).render('register-catechist', {
        title: 'Registro de catequista',
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...getLoginMediaViewModel(),
        ...buildRegisterViewModel({
          errors: result.errors,
          form: {
            name: validation.input.name,
            email: validation.input.email,
            role: validation.input.role,
            parishId: validation.input.parishId || '',
            catechesisLevelIds: validation.input.catechesisLevelIds,
          },
        }),
      });
    }

    return res.redirect('/login?message=Registro%20creado.%20Ya%20pod%C3%A9s%20iniciar%20sesi%C3%B3n.');
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authService.authenticateUser(email, password);

    if (!user) {
      const normalizedEmail = String(email || '').trim().toLowerCase();

      logger.warn({
        event: 'login_failed',
        email: normalizedEmail,
        ip: req.ip,
      }, 'Login failed');

      createAuditLog({
        action: 'login_failed',
        entityType: 'auth',
        metadata: {
          email: normalizedEmail,
          ip: req.ip,
        },
      });

      return res.status(401).render('login', {
        title: 'Iniciar sesión',
        error: 'Email o contraseña incorrectos.',
        message: '',
        email: email || '',
        activeLoginMode: 'catequista',
        csrfToken: res.locals.csrfToken,
        ...getLoginMediaViewModel(),
      });
    }

    return req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return next(regenerateError);
      }

      req.session.userId = user.id;

      return req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((destroyError) => {
    if (destroyError) {
      return next(destroyError);
    }

    res.clearCookie('catequesis.sid');
    return res.redirect('/login');
  });
}

function showDashboard(req, res) {
  const user = res.locals.currentUser;
  const dashboard = DASHBOARD_BY_ROLE[user.role] || {
    badge: 'Usuario',
    heading: 'Dashboard',
    description: 'No hay accesos configurados para este rol.',
    links: [],
  };

  return res.render('dashboard', {
    title: 'Dashboard',
    user,
    dashboard,
    dashboardCardImageUrl: getDashboardCardImageUrl(),
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showAdminDashboard(req, res) {
  return res.render('role-page', {
    title: 'Área admin',
    user: res.locals.currentUser,
    badge: 'Solo admin',
    heading: 'Área administrativa',
    description: 'Esta página está protegida para administradores. Todavía no es un panel completo.',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showCoordinationDashboard(req, res) {
  return res.render('role-page', {
    title: 'Área coordinación',
    user: res.locals.currentUser,
    badge: 'Coordinación',
    heading: 'Área de coordinación',
    description: 'Acceso permitido para coordinación zonal, coordinación parroquial y admin.',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showCatechistDashboard(req, res) {
  return res.render('role-page', {
    title: 'Área catequistas',
    user: res.locals.currentUser,
    badge: 'Catequistas',
    heading: 'Área de catequistas',
    description: 'Gestioná tus grupos, catecúmenos, actividades, guías y progreso desde un solo lugar.',
    links: [
      { href: '/groups/my', label: 'Mis grupos', description: 'Ver y crear tus grupos de catequesis.' },
      { href: '/children/my', label: 'Mis niños', description: 'Ver y registrar catecúmenos asignados.' },
      { href: '/admin/activities', label: 'Actividades', description: 'Crear y gestionar actividades para tus niveles.' },
      { href: '/progress/groups', label: 'Progreso', description: 'Ver avance de tus grupos.' },
      { href: '/guides', label: 'Guías', description: 'Subir y descargar guías anuales.' },
      { href: '/reports/progress.csv', label: 'CSV progreso', description: 'Descargar reporte de tus grupos.' },
    ],
    dashboardCardImageUrl: getDashboardCardImageUrl(),
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

module.exports = {
  showLogin,
  showPasswordRecovery,
  requestPasswordRecovery,
  showPasswordReset,
  resetPassword,
  showSplash,
  showCatechistRegister,
  registerCatechist,
  login,
  logout,
  showDashboard,
  showAdminDashboard,
  showCoordinationDashboard,
  showCatechistDashboard,
};
