const childService = require('../modules/children/child.service');
const {
  CHILD_REMEMBER_COOKIE_NAME,
  getClearChildRememberCookieOptions,
  parseCookieHeader,
} = require('../modules/children/remember-device');

function loadRememberedChild(req, res, next) {
  if (req.session.userId || req.session.childId) {
    return next();
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const rememberCookie = cookies[CHILD_REMEMBER_COOKIE_NAME];

  if (!rememberCookie) {
    return next();
  }

  const child = childService.authenticateRememberToken(rememberCookie);

  if (!child) {
    res.clearCookie(CHILD_REMEMBER_COOKIE_NAME, getClearChildRememberCookieOptions());
    return next();
  }

  req.session.childId = child.id;

  return req.session.save((error) => {
    if (error) {
      return next(error);
    }

    return next();
  });
}

module.exports = {
  loadRememberedChild,
};
