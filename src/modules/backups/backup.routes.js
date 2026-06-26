const express = require('express');
const backupController = require('./backup.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get(
  '/admin/backups',
  requireAuth,
  requireRole([ROLES.ADMIN]),
  backupController.showBackups,
);

router.post(
  '/admin/backups',
  requireAuth,
  requireRole([ROLES.ADMIN]),
  backupController.createBackup,
);

router.get(
  '/admin/backups/:id/download',
  requireAuth,
  requireRole([ROLES.ADMIN]),
  backupController.downloadBackup,
);

module.exports = router;
