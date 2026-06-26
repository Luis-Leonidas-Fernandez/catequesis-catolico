const systemService = require('./system.service');
const escapeHtml = require('../../utils/escape-html');

function showSystem(req, res) {
  return res.render('admin/system', {
    title: 'Sistema',
    user: res.locals.currentUser,
    system: systemService.getSystemOverview(),
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

module.exports = {
  showSystem,
};
