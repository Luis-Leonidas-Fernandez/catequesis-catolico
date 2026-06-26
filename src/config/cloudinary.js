const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

function isCloudinaryConfigured() {
  return Boolean(
    env.cloudinaryCloudName &&
    env.cloudinaryApiKey &&
    env.cloudinaryApiSecret,
  );
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: env.cloudinarySecure,
  });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
