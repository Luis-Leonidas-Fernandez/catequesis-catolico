const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const env = require('../../config/env');
const { cloudinary, isCloudinaryConfigured } = require('../../config/cloudinary');
const mediaRepository = require('./media.repository');
const { withAutoImageFormat } = require('../../utils/cloudinary-image');

function assertCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary no está configurado. Definí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  }
}

function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function normalizeSegment(value) {
  return String(value || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

function buildFolder(parts) {
  const environment = env.nodeEnv === 'production' ? 'production' : 'development';
  return [
    env.cloudinaryRootFolder,
    environment,
    ...parts,
  ].map(normalizeSegment).join('/');
}

async function uploadToCloudinary(filePath, options) {
  assertCloudinaryConfigured();

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: options.resourceType,
    type: options.deliveryType,
    folder: options.folder,
    public_id: options.publicId || undefined,
    overwrite: false,
    use_filename: false,
    unique_filename: true,
    context: options.context || undefined,
  });

  const stats = fs.statSync(filePath);
  const checksumSha256 = calculateSha256(filePath);

  const mediaAssetId = mediaRepository.createMediaAsset({
    ownerType: options.ownerType,
    ownerId: options.ownerId || null,
    parishId: options.parishId || null,
    kind: options.kind,
    visibility: options.visibility,
    accessScope: options.accessScope,
    cloudinaryPublicId: result.public_id,
    resourceType: result.resource_type || options.resourceType,
    deliveryType: result.type || options.deliveryType,
    secureUrl: (result.resource_type || options.resourceType) === 'image' ? withAutoImageFormat(result.secure_url) : (result.secure_url || null),
    format: result.format || path.extname(filePath).slice(1).toLowerCase() || null,
    mimeType: options.mimeType || null,
    bytes: result.bytes || stats.size,
    width: result.width || null,
    height: result.height || null,
    checksumSha256,
    originalFilename: options.originalFilename || path.basename(filePath),
    createdBy: options.createdBy || null,
  });

  return {
    mediaAssetId,
    cloudinaryPublicId: result.public_id,
    secureUrl: (result.resource_type || options.resourceType) === 'image' ? withAutoImageFormat(result.secure_url) : (result.secure_url || null),
    format: result.format || null,
    bytes: result.bytes || stats.size,
    checksumSha256,
  };
}

async function uploadPublicImage(filePath, options = {}) {
  return uploadToCloudinary(filePath, {
    ...options,
    resourceType: 'image',
    deliveryType: 'upload',
    visibility: 'public',
    accessScope: options.accessScope || 'global',
    folder: options.folder || buildFolder(['activities']),
  });
}

async function uploadPrivateRaw(filePath, options = {}) {
  return uploadToCloudinary(filePath, {
    ...options,
    resourceType: 'raw',
    deliveryType: 'authenticated',
    visibility: 'private',
    accessScope: options.accessScope || 'admin_only',
    folder: options.folder || buildFolder(['private']),
  });
}

function buildPrivateDownloadUrl(asset) {
  assertCloudinaryConfigured();

  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  return cloudinary.utils.private_download_url(
    asset.cloudinary_public_id,
    asset.format || '',
    {
      resource_type: asset.resource_type,
      type: asset.delivery_type,
      expires_at: expiresAt,
      attachment: false,
    },
  );
}

function streamPrivateAsset(asset, res, downloadName) {
  const downloadUrl = buildPrivateDownloadUrl(asset);

  res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${String(downloadName || asset.original_filename || 'archivo').replace(/"/g, '')}"`,
  );

  return https.get(downloadUrl, (cloudinaryResponse) => {
    if (cloudinaryResponse.statusCode >= 400) {
      res.status(cloudinaryResponse.statusCode).end('No se pudo descargar el archivo.');
      return;
    }

    cloudinaryResponse.pipe(res);
  }).on('error', () => {
    if (!res.headersSent) {
      res.status(502);
    }
    res.end('No se pudo descargar el archivo.');
  });
}

async function deleteCloudinaryAsset(asset) {
  if (!asset || !asset.cloudinary_public_id || !isCloudinaryConfigured()) {
    return;
  }

  await cloudinary.uploader.destroy(asset.cloudinary_public_id, {
    resource_type: asset.resource_type,
    type: asset.delivery_type,
    invalidate: true,
  });

  mediaRepository.softDeleteMediaAsset(asset.id);
}

module.exports = {
  buildFolder,
  deleteCloudinaryAsset,
  findMediaAssetById: mediaRepository.findMediaAssetById,
  findMediaAssetByOwner: mediaRepository.findMediaAssetByOwner,
  isCloudinaryConfigured,
  streamPrivateAsset,
  updateMediaAssetOwner: mediaRepository.updateMediaAssetOwner,
  uploadPrivateRaw,
  uploadPublicImage,
};
