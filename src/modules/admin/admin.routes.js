const express = require('express');
const adminController = require('./admin.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get('/admin/dashboard', requireAuth, requireRole([ROLES.ADMIN]), adminController.showAdminDashboard);

module.exports = router;
