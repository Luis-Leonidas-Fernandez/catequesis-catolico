const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { withAutoImageFormat } = require('./cloudinary-image');

const LOCAL_DASHBOARD_CARD_IMAGE_URL = '/assets/images/login-poster.png';
const PUBLIC_DIRECTORY = path.join(__dirname, '..', '..', 'public');

function publicFileExists(publicUrl) {
  const relativePath = publicUrl.replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC_DIRECTORY, relativePath));
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

function getDashboardCardImageUrl() {
  const externalUrl = getValidExternalUrl(env.dashboardCardImageUrl);

  if (externalUrl) {
    return withAutoImageFormat(externalUrl);
  }

  if (publicFileExists(LOCAL_DASHBOARD_CARD_IMAGE_URL)) {
    return LOCAL_DASHBOARD_CARD_IMAGE_URL;
  }

  return '';
}

module.exports = {
  getDashboardCardImageUrl,
};
