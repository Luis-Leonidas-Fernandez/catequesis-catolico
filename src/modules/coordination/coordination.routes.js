const express = require('express');
const coordinationController = require('./coordination.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.use(
  '/coordinacion',
  requireAuth,
  requireRole([ROLES.COORDINADOR_PARROQUIAL, ROLES.COORDINADOR_ZONAL]),
);

router.get('/coordinacion/grupos', coordinationController.showGroups);
router.get('/coordinacion/ninos', coordinationController.showChildren);
router.get('/coordinacion/catequistas', coordinationController.showCatechists);

module.exports = router;
