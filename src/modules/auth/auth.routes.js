const express = require('express');
const authController = require('./auth.controller');
const { ROLES } = require('./roles');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const router = express.Router();

router.get('/login', authController.showLogin);
router.get('/splash', authController.showSplash);
router.get('/registro-catequista', authController.showCatechistRegister);
router.post('/registro-catequista', authController.registerCatechist);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/dashboard', requireAuth, authController.showDashboard);
router.get('/dashboard/admin', requireAuth, requireRole([ROLES.ADMIN]), authController.showAdminDashboard);
router.get(
  '/dashboard/coordinacion',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.COORDINADOR_ZONAL, ROLES.COORDINADOR_PARROQUIAL]),
  authController.showCoordinationDashboard,
);
router.get(
  '/coordinacion',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.COORDINADOR_ZONAL, ROLES.COORDINADOR_PARROQUIAL]),
  authController.showCoordinationDashboard,
);
router.get(
  '/dashboard/catequesis',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  authController.showCatechistDashboard,
);

module.exports = router;
