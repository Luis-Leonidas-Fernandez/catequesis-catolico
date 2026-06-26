const progressService = require('./progress.service');
const escapeHtml = require('../../utils/escape-html');

function showChildProgress(req, res) {
  if (!req.session.childId) {
    return res.redirect('/acceso-nino');
  }

  const progress = progressService.getChildProgress(req.session.childId);

  if (!progress) {
    delete req.session.childId;
    return res.redirect('/acceso-nino');
  }

  return res.render('child-access/progress', {
    title: 'Mi progreso',
    progress,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

function showGroupProgress(req, res) {
  const progress = progressService.getGroupProgress(res.locals.currentUser);

  return res.render('progress/groups', {
    title: 'Progreso grupal',
    user: res.locals.currentUser,
    progress,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

module.exports = {
  showChildProgress,
  showGroupProgress,
};
