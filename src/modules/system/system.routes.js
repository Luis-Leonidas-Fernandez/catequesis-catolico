const express = require('express');
const systemController = require('./system.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get(
  '/admin/system',
  requireAuth,
  requireRole([ROLES.ADMIN]),
  systemController.showSystem,
);

module.exports = router;
