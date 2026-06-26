const authService = require('../modules/auth/auth.service');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = authService.getSessionUser(req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  res.locals.currentUser = user;
  return next();
}

function loadCurrentUser(req, res, next) {
  res.locals.currentUser = null;

  if (!req.session.userId) {
    return next();
  }

  const user = authService.getSessionUser(req.session.userId);

  if (user) {
    res.locals.currentUser = user;
  }

  return next();
}

module.exports = {
  requireAuth,
  loadCurrentUser,
};
