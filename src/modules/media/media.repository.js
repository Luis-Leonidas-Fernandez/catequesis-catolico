const { db } = require('../../config/database');

function createMediaAsset(asset) {
  const result = db
    .prepare(
      `
        INSERT INTO media_assets (
          owner_type,
          owner_id,
          parish_id,
          kind,
          visibility,
          access_scope,
          provider,
          cloudinary_public_id,
          resource_type,
          delivery_type,
          secure_url,
          format,
          mime_type,
          bytes,
          width,
          height,
          checksum_sha256,
          original_filename,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      asset.ownerType,
      asset.ownerId || null,
      asset.parishId || null,
      asset.kind,
      asset.visibility,
      asset.accessScope,
      asset.provider || 'cloudinary',
      asset.cloudinaryPublicId,
      asset.resourceType,
      asset.deliveryType,
      asset.secureUrl || null,
      asset.format || null,
      asset.mimeType || null,
      asset.bytes || null,
      asset.width || null,
      asset.height || null,
      asset.checksumSha256 || null,
      asset.originalFilename || null,
      asset.createdBy || null,
    );

  return result.lastInsertRowid;
}

function updateMediaAssetOwner(id, ownerType, ownerId) {
  return db
    .prepare(
      `
        UPDATE media_assets
        SET owner_type = ?,
            owner_id = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(ownerType, ownerId, id);
}

function findMediaAssetById(id) {
  return db
    .prepare(
      `
        SELECT *
        FROM media_assets
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function findMediaAssetByOwner(ownerType, ownerId, kind) {
  return db
    .prepare(
      `
        SELECT *
        FROM media_assets
        WHERE owner_type = ?
          AND owner_id = ?
          AND kind = ?
          AND deleted_at IS NULL
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(ownerType, ownerId, kind);
}

function softDeleteMediaAsset(id) {
  return db
    .prepare(
      `
        UPDATE media_assets
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(id);
}

module.exports = {
  createMediaAsset,
  findMediaAssetById,
  findMediaAssetByOwner,
  softDeleteMediaAsset,
  updateMediaAssetOwner,
};
