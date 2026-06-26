const express = require('express');
const progressController = require('./progress.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get('/nino/progreso', progressController.showChildProgress);

router.get(
  '/progress/groups',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  progressController.showGroupProgress,
);

module.exports = router;
