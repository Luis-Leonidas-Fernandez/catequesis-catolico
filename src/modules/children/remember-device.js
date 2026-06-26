const env = require('../../config/env');

const CHILD_REMEMBER_COOKIE_NAME = 'catequesis.child_remember';
const CHILD_REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function getChildRememberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: CHILD_REMEMBER_MAX_AGE,
    path: '/',
  };
}

function getClearChildRememberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  };
}

function parseCookieHeader(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);

      try {
        cookies[name] = decodeURIComponent(value);
      } catch (error) {
        cookies[name] = value;
      }

      return cookies;
    }, {});
}

module.exports = {
  CHILD_REMEMBER_COOKIE_NAME,
  CHILD_REMEMBER_MAX_AGE,
  getChildRememberCookieOptions,
  getClearChildRememberCookieOptions,
  parseCookieHeader,
};
