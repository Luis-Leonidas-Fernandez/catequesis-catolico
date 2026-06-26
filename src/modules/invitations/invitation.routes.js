const express = require('express');
const invitationController = require('./invitation.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get('/registro-coordinador', invitationController.showCoordinatorRegistration);
router.post('/registro-coordinador', invitationController.completeCoordinatorRegistration);

router.use('/admin/invitations', requireAuth, requireRole([ROLES.ADMIN]));
router.get('/admin/invitations', invitationController.showInvitations);
router.get('/admin/invitations/new', invitationController.showNewInvitation);
router.post('/admin/invitations', invitationController.createInvitation);

module.exports = router;
