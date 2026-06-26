const csrf = require('csurf');
const helmet = require('helmet');
const { getLoginVideoOrigin } = require('../utils/login-media');

const cloudinarySrc = 'https://res.cloudinary.com';
const mediaSrc = ["'self'", cloudinarySrc];
const loginVideoOrigin = getLoginVideoOrigin();

if (loginVideoOrigin) {
  mediaSrc.push(loginVideoOrigin);
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', cloudinarySrc],
      mediaSrc,
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      upgradeInsecureRequests: [],
    },
  },
});

const csrfProtection = csrf();

function shouldSkipCsrf(req) {
  return false;
}

function applyCsrfProtection(req, res, next) {
  if (shouldSkipCsrf(req)) {
    return next();
  }

  return csrfProtection(req, res, next);
}

function exposeCsrfToken(req, res, next) {
  if (shouldSkipCsrf(req)) {
    res.locals.csrfToken = '';
    return next();
  }

  res.locals.csrfToken = req.csrfToken();
  return next();
}

module.exports = {
  applyCsrfProtection,
  helmetMiddleware,
  exposeCsrfToken,
};
