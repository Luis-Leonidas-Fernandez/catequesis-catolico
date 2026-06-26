const invitationService = require('./invitation.service');
const {
  COORDINATOR_ROLES,
  validateCoordinatorRegistration,
  validateCreateInvitation,
} = require('./invitation.validators');
const escapeHtml = require('../../utils/escape-html');
const { getLoginMediaViewModel } = require('../../utils/login-media');

function buildInvitationForm(overrides = {}) {
  return {
    errors: {},
    form: {
      email: '',
      role: COORDINATOR_ROLES[0],
      expiresInHours: 72,
    },
    roles: COORDINATOR_ROLES,
    ...overrides,
  };
}

function showInvitations(req, res) {
  return res.render('admin/invitations/index', {
    title: 'Invitaciones de coordinadores',
    user: res.locals.currentUser,
    invitations: invitationService.listInvitations(),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

function showNewInvitation(req, res) {
  return res.render('admin/invitations/new', {
    title: 'Invitar coordinador',
    user: res.locals.currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildInvitationForm(),
  });
}

async function createInvitation(req, res, next) {
  try {
    const validation = validateCreateInvitation(req.body);

    if (!validation.isValid) {
      return res.status(422).render('admin/invitations/new', {
        title: 'Invitar coordinador',
        user: res.locals.currentUser,
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...buildInvitationForm({
          errors: validation.errors,
          form: validation.input,
        }),
      });
    }

    const result = await invitationService.createInvitation(validation.input, res.locals.currentUser);

    if (!result.ok) {
      return res.status(422).render('admin/invitations/new', {
        title: 'Invitar coordinador',
        user: res.locals.currentUser,
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...buildInvitationForm({
          errors: result.errors,
          form: validation.input,
        }),
      });
    }

    return res.redirect('/admin/invitations?message=Invitaci%C3%B3n%20enviada');
  } catch (error) {
    if (error.code === 'SMTP_NOT_CONFIGURED') {
      return res.status(422).render('admin/invitations/new', {
        title: 'Invitar coordinador',
        user: res.locals.currentUser,
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...buildInvitationForm({
          errors: {
            email: `No se pudo enviar el correo. Configurá SMTP: ${error.missing.join(', ')}.`,
          },
          form: {
            email: String(req.body.email || '').trim().toLowerCase(),
            role: String(req.body.role || ''),
            expiresInHours: Number(req.body.expiresInHours || 72),
          },
        }),
      });
    }

    return next(error);
  }
}

function buildRegistrationViewModel(token, overrides = {}) {
  return {
    token,
    errors: {},
    form: {
      name: '',
      parishName: '',
    },
    invitation: null,
    pageError: '',
    ...overrides,
  };
}

function showCoordinatorRegistration(req, res) {
  const token = String(req.query.token || '').trim();
  const invitationResult = invitationService.getInvitationForRegistration(token);

  return res.render('register-coordinator', {
    title: 'Registro de coordinador',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...getLoginMediaViewModel(),
    ...buildRegistrationViewModel(token, invitationResult.ok
      ? { invitation: invitationResult.invitation }
      : { pageError: invitationResult.error }),
  });
}

async function completeCoordinatorRegistration(req, res, next) {
  try {
    const token = String(req.body.token || '').trim();
    const invitationResult = invitationService.getInvitationForRegistration(token);
    const validation = validateCoordinatorRegistration(req.body);

    if (!invitationResult.ok || !validation.isValid) {
      return res.status(422).render('register-coordinator', {
        title: 'Registro de coordinador',
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...getLoginMediaViewModel(),
        ...buildRegistrationViewModel(token, {
          invitation: invitationResult.ok ? invitationResult.invitation : null,
          pageError: invitationResult.ok ? '' : invitationResult.error,
          errors: validation.errors,
          form: {
            name: validation.input.name,
            parishName: validation.input.parishName,
          },
        }),
      });
    }

    const result = await invitationService.completeCoordinatorRegistration(token, validation.input);

    if (!result.ok) {
      return res.status(422).render('register-coordinator', {
        title: 'Registro de coordinador',
        csrfToken: res.locals.csrfToken,
        escapeHtml,
        ...getLoginMediaViewModel(),
        ...buildRegistrationViewModel(token, {
          invitation: invitationResult.invitation,
          errors: result.errors || {},
          pageError: result.error || '',
          form: {
            name: validation.input.name,
            parishName: validation.input.parishName,
          },
        }),
      });
    }

    return res.redirect('/login?message=Registro%20de%20coordinador%20creado.%20Ya%20pod%C3%A9s%20iniciar%20sesi%C3%B3n.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  completeCoordinatorRegistration,
  createInvitation,
  showCoordinatorRegistration,
  showInvitations,
  showNewInvitation,
};
