const fs = require('fs');
const path = require('path');
const { db } = require('../../config/database');
const logger = require('../../config/logger');
const backupRepository = require('./backup.repository');
const mediaService = require('../media/media.service');

const BACKUPS_DIRECTORY = path.join(process.cwd(), 'backups');

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildBackupFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `catequesis_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.sqlite`;
}

function ensureBackupsDirectory() {
  fs.mkdirSync(BACKUPS_DIRECTORY, { recursive: true });
}

function listBackups() {
  return backupRepository.listBackups();
}

async function createManualBackup(actor) {
  ensureBackupsDirectory();

  const fileName = buildBackupFileName();
  const absolutePath = path.join(BACKUPS_DIRECTORY, fileName);
  const relativePath = path.join('backups', fileName);

  try {
    await db.backup(absolutePath);

    const fileStats = fs.statSync(absolutePath);
    const cloudUpload = await mediaService.uploadPrivateRaw(absolutePath, {
      ownerType: 'backups',
      ownerId: null,
      parishId: null,
      kind: 'sqlite_backup',
      accessScope: 'admin_only',
      folder: mediaService.buildFolder(['backups']),
      mimeType: 'application/vnd.sqlite3',
      originalFilename: fileName,
      createdBy: actor.id,
    });

    const backupId = backupRepository.runInTransaction(() => {
      const createdBackupId = backupRepository.createBackupRecord({
        filePath: cloudUpload.cloudinaryPublicId || relativePath,
        mediaAssetId: cloudUpload.mediaAssetId,
        status: 'created',
        createdBy: actor.id,
      });
      mediaService.updateMediaAssetOwner(cloudUpload.mediaAssetId, 'backups', createdBackupId);

      backupRepository.createAuditLog({
        userId: actor.id,
        action: 'backup_created',
        entityType: 'backups',
        entityId: createdBackupId,
        metadata: {
          filePath: cloudUpload.cloudinaryPublicId || relativePath,
          mediaAssetId: cloudUpload.mediaAssetId,
          sizeBytes: fileStats.size,
        },
      });

      return createdBackupId;
    });

    logger.info({
      event: 'backup_created',
      userId: actor.id,
      backupId,
      filePath: cloudUpload.cloudinaryPublicId || relativePath,
      sizeBytes: fileStats.size,
    }, 'Manual SQLite backup created');

    fs.unlinkSync(absolutePath);

    return {
      ok: true,
      backupId,
      filePath: relativePath,
    };
  } catch (error) {
    logger.error({
      event: 'backup_failed',
      userId: actor.id,
      filePath: relativePath,
      err: error,
    }, 'Manual SQLite backup failed');

    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (unlinkError) {
      logger.warn({
        event: 'backup_cleanup_failed',
        filePath: relativePath,
        err: unlinkError,
      }, 'Could not remove failed backup file');
    }

    return {
      ok: false,
      error: 'No se pudo crear el backup. Revisá los logs del sistema.',
    };
  }
}

function getBackupDownload(id) {
  const backup = backupRepository.findBackupById(id);

  if (!backup || backup.status !== 'created' || !backup.media_asset_id) {
    return null;
  }

  const mediaAsset = mediaService.findMediaAssetById(backup.media_asset_id);

  if (!mediaAsset) {
    return null;
  }

  return {
    backup,
    mediaAsset,
  };
}

module.exports = {
  createManualBackup,
  getBackupDownload,
  listBackups,
};
