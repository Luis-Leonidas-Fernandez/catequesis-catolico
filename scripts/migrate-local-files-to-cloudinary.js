const fs = require('fs');
const path = require('path');
const { db } = require('../src/config/database');
const mediaService = require('../src/modules/media/media.service');

function resolveProjectPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function exists(filePath) {
  return filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

async function migrateActivityImages() {
  const activities = db
    .prepare(`
      SELECT id, image_path, media_asset_id
      FROM activities
      WHERE deleted_at IS NULL
        AND image_path IS NOT NULL
        AND image_path != ''
        AND media_asset_id IS NULL
    `)
    .all();

  let migrated = 0;

  for (const activity of activities) {
    if (!activity.image_path.startsWith('/uploads/images/')) {
      continue;
    }

    const absolutePath = resolveProjectPath(path.join('uploads', 'public', 'images', path.basename(activity.image_path)));

    if (!exists(absolutePath)) {
      console.warn(`[activities] No existe archivo local para activity ${activity.id}: ${absolutePath}`);
      continue;
    }

    const upload = await mediaService.uploadPublicImage(absolutePath, {
      ownerType: 'activities',
      ownerId: activity.id,
      kind: 'activity_image',
      accessScope: 'global',
      folder: mediaService.buildFolder(['activities']),
      mimeType: undefined,
      originalFilename: path.basename(absolutePath),
      createdBy: null,
    });

    db.prepare('UPDATE activities SET image_path = ?, media_asset_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(upload.secureUrl, upload.mediaAssetId, activity.id);
    migrated += 1;
  }

  return migrated;
}

async function migrateGuides() {
  const guides = db
    .prepare(`
      SELECT id, parish_id, year, title, file_path, media_asset_id
      FROM guides
      WHERE deleted_at IS NULL
        AND file_path IS NOT NULL
        AND file_path != ''
        AND media_asset_id IS NULL
    `)
    .all();

  let migrated = 0;

  for (const guide of guides) {
    const absolutePath = resolveProjectPath(guide.file_path);

    if (!exists(absolutePath)) {
      console.warn(`[guides] No existe archivo local para guide ${guide.id}: ${absolutePath}`);
      continue;
    }

    const upload = await mediaService.uploadPrivateRaw(absolutePath, {
      ownerType: 'guides',
      ownerId: guide.id,
      parishId: guide.parish_id,
      kind: 'guide_pdf',
      accessScope: 'parish',
      folder: mediaService.buildFolder(['guides', `parish-${guide.parish_id || 'sin-parroquia'}`, String(guide.year || 'sin-anio')]),
      mimeType: 'application/pdf',
      originalFilename: `${guide.title || `guia-${guide.id}`}.pdf`,
      createdBy: null,
    });

    db.prepare('UPDATE guides SET file_path = ?, media_asset_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(upload.cloudinaryPublicId, upload.mediaAssetId, guide.id);
    migrated += 1;
  }

  return migrated;
}

async function migrateBackups() {
  const backups = db
    .prepare(`
      SELECT id, file_path, media_asset_id
      FROM backups
      WHERE file_path IS NOT NULL
        AND file_path != ''
        AND media_asset_id IS NULL
    `)
    .all();

  let migrated = 0;

  for (const backup of backups) {
    const absolutePath = resolveProjectPath(backup.file_path);

    if (!exists(absolutePath)) {
      console.warn(`[backups] No existe archivo local para backup ${backup.id}: ${absolutePath}`);
      continue;
    }

    const upload = await mediaService.uploadPrivateRaw(absolutePath, {
      ownerType: 'backups',
      ownerId: backup.id,
      kind: 'sqlite_backup',
      accessScope: 'admin_only',
      folder: mediaService.buildFolder(['backups']),
      mimeType: 'application/vnd.sqlite3',
      originalFilename: path.basename(absolutePath),
      createdBy: null,
    });

    db.prepare('UPDATE backups SET file_path = ?, media_asset_id = ? WHERE id = ?')
      .run(upload.cloudinaryPublicId, upload.mediaAssetId, backup.id);
    migrated += 1;
  }

  return migrated;
}

async function main() {
  if (!mediaService.isCloudinaryConfigured()) {
    throw new Error('Cloudinary no está configurado. Revisá CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  }

  const result = {
    activityImages: await migrateActivityImages(),
    guides: await migrateGuides(),
    backups: await migrateBackups(),
  };

  console.log('Migración local -> Cloudinary finalizada:');
  console.log(JSON.stringify(result, null, 2));
  console.log('Los archivos locales NO fueron borrados para permitir rollback manual.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
