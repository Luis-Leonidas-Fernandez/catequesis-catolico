const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mediaService = require('../media/media.service');

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
const UPLOADS_DIRECTORY = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp', 'activity-images');
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function ensureUploadsDirectory() {
  fs.mkdirSync(UPLOADS_DIRECTORY, { recursive: true });
}

function getExtension(fileName) {
  return path.extname(String(fileName || '')).toLowerCase();
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    ensureUploadsDirectory();
    callback(null, UPLOADS_DIRECTORY);
  },
  filename(req, file, callback) {
    const extension = getExtension(file.originalname);
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

function fileFilter(req, file, callback) {
  const extension = getExtension(file.originalname);

  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    req.uploadError = 'La imagen debe ser JPG, PNG o WebP.';
    return callback(null, false);
  }

  return callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
});

function uploadActivityImage(req, res, next) {
  return upload.single('image')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      req.uploadError = 'La imagen no puede superar los 3 MB.';
      return next();
    }

    if (error) {
      req.uploadError = 'No se pudo procesar la imagen. Probá con un archivo JPG, PNG o WebP.';
      return next();
    }

    return next();
  });
}

function hasValidMagicBytes(filePath, mimetype) {
  const buffer = fs.readFileSync(filePath);

  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  return false;
}

function deleteUploadedActivityImage(file) {
  if (!file || !file.path) {
    return;
  }

  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function validateUploadedActivityImage(file, actor) {
  if (!file) {
    return {
      ok: true,
      imagePath: null,
      mediaAssetId: null,
    };
  }

  if (!hasValidMagicBytes(file.path, file.mimetype)) {
    deleteUploadedActivityImage(file);
    return {
      ok: false,
      error: 'El archivo no parece ser una imagen válida.',
    };
  }

  try {
    const upload = await mediaService.uploadPublicImage(file.path, {
      ownerType: 'activities',
      ownerId: null,
      parishId: actor.parishId || null,
      kind: 'activity_image',
      accessScope: 'global',
      folder: mediaService.buildFolder(['activities']),
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      createdBy: actor.id,
    });

    deleteUploadedActivityImage(file);

    return {
      ok: true,
      imagePath: upload.secureUrl,
      mediaAssetId: upload.mediaAssetId,
    };
  } catch (error) {
    deleteUploadedActivityImage(file);
    return {
      ok: false,
      error: error.message,
    };
  }
}

module.exports = {
  UPLOADS_DIRECTORY,
  deleteUploadedActivityImage,
  uploadActivityImage,
  validateUploadedActivityImage,
};
