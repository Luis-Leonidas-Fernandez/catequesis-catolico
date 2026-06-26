const CLOUDINARY_IMAGE_UPLOAD_MARKER = '/image/upload/';
const DEFAULT_IMAGE_TRANSFORMATION = 'f_auto,q_auto';

function isCloudinaryImageUploadUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'res.cloudinary.com'
      && url.pathname.includes(CLOUDINARY_IMAGE_UPLOAD_MARKER);
  } catch (error) {
    return false;
  }
}

function hasFormatAutoTransformation(pathname) {
  const markerIndex = pathname.indexOf(CLOUDINARY_IMAGE_UPLOAD_MARKER);

  if (markerIndex === -1) {
    return false;
  }

  const afterUpload = pathname.slice(markerIndex + CLOUDINARY_IMAGE_UPLOAD_MARKER.length);
  const firstVersionIndex = afterUpload.search(/(?:^|\/)v\d+(?:\/|$)/);
  const transformationArea = firstVersionIndex === -1
    ? afterUpload.split('/').slice(0, 2).join('/')
    : afterUpload.slice(0, firstVersionIndex);

  return /(?:^|[,/])f_auto(?:[,/]|$)/.test(transformationArea);
}

function withAutoImageFormat(value) {
  if (!isCloudinaryImageUploadUrl(value)) {
    return value || '';
  }

  const url = new URL(value);

  if (hasFormatAutoTransformation(url.pathname)) {
    return url.toString();
  }

  url.pathname = url.pathname.replace(
    CLOUDINARY_IMAGE_UPLOAD_MARKER,
    `${CLOUDINARY_IMAGE_UPLOAD_MARKER}${DEFAULT_IMAGE_TRANSFORMATION}/`,
  );

  return url.toString();
}

module.exports = {
  DEFAULT_IMAGE_TRANSFORMATION,
  isCloudinaryImageUploadUrl,
  withAutoImageFormat,
};
