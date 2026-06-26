const express = require('express');
const userController = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.use('/admin/users', requireAuth, requireRole([ROLES.ADMIN]));

router.get('/admin/users', userController.showUsers);
router.get('/admin/users/new', userController.showNewUser);
router.post('/admin/users', userController.createUser);
router.get('/admin/users/:id/edit', userController.showEditUser);
router.post('/admin/users/:id', userController.updateUser);
router.post('/admin/users/:id/deactivate', userController.deactivateUser);

module.exports = router;
