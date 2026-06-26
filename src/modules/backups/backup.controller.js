const backupService = require('./backup.service');
const mediaService = require('../media/media.service');
const escapeHtml = require('../../utils/escape-html');

function showBackups(req, res) {
  return res.render('admin/backups', {
    title: 'Backups',
    user: res.locals.currentUser,
    backups: backupService.listBackups(),
    message: req.query.message || '',
    error: req.query.error || '',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

async function createBackup(req, res, next) {
  try {
    const result = await backupService.createManualBackup(res.locals.currentUser);

    if (!result.ok) {
      return res.redirect(`/admin/backups?error=${encodeURIComponent(result.error)}`);
    }

    return res.redirect('/admin/backups?message=Backup%20creado');
  } catch (error) {
    return next(error);
  }
}

function downloadBackup(req, res, next) {
  const result = backupService.getBackupDownload(Number(req.params.id));

  if (!result) {
    return next();
  }

  return mediaService.streamPrivateAsset(
    result.mediaAsset,
    res,
    result.mediaAsset.original_filename || `backup-${result.backup.id}.sqlite`,
  );
}

module.exports = {
  createBackup,
  downloadBackup,
  showBackups,
};
