const express = require('express');
const childController = require('./child.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { ROLES } = require('../auth/roles');

const router = express.Router();

router.get('/acceso-nino', childController.showChildAccess);
router.post('/acceso-nino', childController.accessChild);
router.get('/perfil-nino', childController.showChildProfile);
router.get('/nino-actividades', (req, res) => res.redirect('/nino/actividades'));
router.get('/nino/actividades', childController.showChildActivities);
router.get('/nino/guias', childController.showChildGuides);
router.get('/nino/guias/:id/download', childController.downloadChildGuide);
router.get('/nino/actividades/:id/jugar', childController.showChildActivityGame);
router.post('/nino/actividades/:id/responder', childController.answerChildActivityQuestion);
router.post('/salir-nino', childController.exitChild);

router.use(
  '/admin/children',
  requireAuth,
  requireRole([ROLES.ADMIN]),
);

router.get('/admin/children', childController.showChildren);
router.get('/admin/children/new', childController.showNewChild);
router.post('/admin/children', childController.createChild);
router.get('/admin/children/:id/edit', childController.showEditChild);
router.post('/admin/children/:id', childController.updateChild);
router.post('/admin/children/:id/deactivate', childController.deactivateChild);

router.get(
  '/children/my',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  childController.showMyChildren,
);

router.get(
  '/children/my/new',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  childController.showNewMyChild,
);

router.post(
  '/children/my',
  requireAuth,
  requireRole([ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  childController.createMyChild,
);

router.post(
  '/children/:id/regenerate-code',
  requireAuth,
  requireRole([ROLES.ADMIN, ROLES.CATEQUISTA_FAMILIAR, ROLES.CATEQUISTA_JUVENIL]),
  childController.regenerateAccessCode,
);

module.exports = router;
