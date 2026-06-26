const express = require('express');
const reportController = require('./report.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get(
  '/reports/progress.csv',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  reportController.downloadProgressCsv,
);

module.exports = router;
