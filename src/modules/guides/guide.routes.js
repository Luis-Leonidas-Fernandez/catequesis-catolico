const express = require('express');
const guideController = require('./guide.controller');
const { uploadGuideFile } = require('./guide-upload');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get(
  '/guides',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  guideController.showGuides,
);

router.post(
  '/guides',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  uploadGuideFile,
  guideController.createGuide,
);

router.post(
  '/guides/:id/delete',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  guideController.deleteGuide,
);

router.get(
  '/guides/:id/download',
  requireAuth,
  requireRole([
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ]),
  guideController.downloadGuide,
);

module.exports = router;
