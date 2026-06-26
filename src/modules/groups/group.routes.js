const express = require('express');
const groupController = require('./group.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.use(
  '/admin/groups',
  requireAuth,
  requireRole([ROLES.ADMIN]),
);

router.get('/admin/groups', groupController.showGroups);
router.get('/admin/groups/new', groupController.showNewGroup);
router.post('/admin/groups', groupController.createGroup);
router.get('/admin/groups/:id/edit', groupController.showEditGroup);
router.post('/admin/groups/:id', groupController.updateGroup);
router.post('/admin/groups/:id/deactivate', groupController.deactivateGroup);

router.get(
  '/groups/my',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  groupController.showMyGroups,
);

router.get(
  '/groups/my/new',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  groupController.showNewMyGroup,
);

router.post(
  '/groups/my',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  groupController.createMyGroup,
);

module.exports = router;
