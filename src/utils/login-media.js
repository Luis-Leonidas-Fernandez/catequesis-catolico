const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { withAutoImageFormat } = require('./cloudinary-image');

const LOCAL_LOGIN_POSTER_URL = '/assets/images/login-poster.png';
const PUBLIC_DIRECTORY = path.join(__dirname, '..', '..', 'public');

function publicFileExists(publicUrl) {
  const relativePath = publicUrl.replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC_DIRECTORY, relativePath));
}

function getValidExternalLoginVideoUrl() {
  return getValidExternalUrl(env.loginVideoUrl);
}

function getValidExternalLoginPosterUrl() {
  return getValidExternalUrl(env.loginPosterUrl);
}

function getValidExternalUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch (error) {
    return null;
  }
}

function getLoginVideoUrl() {
  return getValidExternalLoginVideoUrl();
}

function getLoginPosterUrl() {
  const externalUrl = getValidExternalLoginPosterUrl();

  if (externalUrl) {
    return withAutoImageFormat(externalUrl);
  }

  if (publicFileExists(LOCAL_LOGIN_POSTER_URL)) {
    return LOCAL_LOGIN_POSTER_URL;
  }

  return null;
}

function getLoginVideoOrigin() {
  const externalUrl = getValidExternalLoginVideoUrl();

  if (!externalUrl) {
    return null;
  }

  return new URL(externalUrl).origin;
}

function getLoginMediaViewModel() {
  return {
    loginVideoUrl: getLoginVideoUrl(),
    loginPosterUrl: getLoginPosterUrl(),
  };
}

module.exports = {
  getLoginMediaViewModel,
  getLoginVideoOrigin,
  getLoginVideoUrl,
  getLoginPosterUrl,
};
