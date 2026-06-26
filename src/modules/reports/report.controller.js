const reportService = require('./report.service');

function downloadProgressCsv(req, res) {
  const result = reportService.exportProgressCsv(req.query, res.locals.currentUser);

  if (result.forbidden) {
    return res.status(403).send('No tenés permiso para exportar este reporte.');
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.send(`\uFEFF${result.csv}`);
}

module.exports = {
  downloadProgressCsv,
};
