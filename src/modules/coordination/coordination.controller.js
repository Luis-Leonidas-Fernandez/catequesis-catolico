const coordinationService = require('./coordination.service');
const escapeHtml = require('../../utils/escape-html');

function renderPage(res, view, title, payload = {}) {
  return res.render(view, {
    title,
    user: res.locals.currentUser,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...payload,
  });
}

function showGroups(req, res) {
  return renderPage(res, 'coordination/groups', 'Grupos de mi parroquia', {
    groups: coordinationService.listParishGroups(res.locals.currentUser),
  });
}

function showChildren(req, res) {
  return renderPage(res, 'coordination/children', 'Niños de mi parroquia', {
    children: coordinationService.listParishChildren(res.locals.currentUser),
  });
}

function showCatechists(req, res) {
  return renderPage(res, 'coordination/catechists', 'Catequistas de mi parroquia', {
    catechists: coordinationService.listParishCatechists(res.locals.currentUser),
  });
}

module.exports = {
  showCatechists,
  showChildren,
  showGroups,
};
