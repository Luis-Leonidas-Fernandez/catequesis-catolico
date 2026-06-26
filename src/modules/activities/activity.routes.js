const express = require('express');
const activityController = require('./activity.controller');
const { uploadActivityImage } = require('./activity-image-upload');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.use(
  '/admin/activities',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
);

router.get('/admin/activities', activityController.showActivities);
router.get('/admin/activities/new', activityController.showNewActivity);
router.post('/admin/activities', uploadActivityImage, activityController.createActivity);
router.get('/admin/activities/:id/edit', activityController.showEditActivity);
router.post('/admin/activities/:id', uploadActivityImage, activityController.updateActivity);
router.post('/admin/activities/:id/deactivate', activityController.deactivateActivity);

module.exports = router;
