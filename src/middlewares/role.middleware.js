const { ROLES } = require('../modules/auth/roles');
const escapeHtml = require('../utils/escape-html');

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const user = res.locals.currentUser;

    if (!user) {
      return res.redirect('/login');
    }

    if (user.role === ROLES.ADMIN) {
      return next();
    }

    if (allowedRoles.includes(user.role)) {
      return next();
    }

    return res.status(403).render('forbidden', {
      title: 'Acceso denegado',
      user,
      allowedRoles,
      escapeHtml,
    });
  };
}

module.exports = {
  requireRole,
};
