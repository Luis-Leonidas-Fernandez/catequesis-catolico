const reportRepository = require('./report.repository');
const { ROLES } = require('../auth/roles');

const HEADERS = [
  'niño',
  'grupo',
  'catequista',
  'nivel de catequesis',
  'actividades completadas',
  'correctas',
  'incorrectas',
  'porcentaje de progreso',
  'última actividad',
  'último acceso',
];

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value) {
  const text = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  return text;
}

function normalizeFilters(query) {
  return {
    catechistId: parsePositiveInteger(query.catechistId),
    groupId: parsePositiveInteger(query.groupId),
    catechesisLevelId: parsePositiveInteger(query.catechesisLevelId),
    activityId: parsePositiveInteger(query.activityId),
    startDate: parseDate(query.startDate),
    endDate: parseDate(query.endDate),
  };
}

function canExportProgress(user) {
  return [
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ].includes(user.role);
}

function sanitizeCsvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const lines = [HEADERS.map(sanitizeCsvCell).join(',')];

  for (const row of rows) {
    lines.push([
      row.child_name,
      row.group_name,
      row.catechist_name,
      row.catechesis_level_name,
      row.completed_activities,
      row.correct_answers,
      row.incorrect_answers,
      `${row.progress_percentage}%`,
      row.last_activity,
      row.last_access_at,
    ].map(sanitizeCsvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function buildFilename(filters) {
  const suffix = [
    filters.startDate ? `desde-${filters.startDate}` : '',
    filters.endDate ? `hasta-${filters.endDate}` : '',
  ].filter(Boolean).join('-');

  return `reporte-progreso${suffix ? `-${suffix}` : ''}.csv`;
}

function exportProgressCsv(query, user) {
  if (!canExportProgress(user)) {
    return {
      ok: false,
      forbidden: true,
    };
  }

  const filters = normalizeFilters(query);
  const rows = reportRepository.listProgressRows(filters, user);

  return {
    ok: true,
    csv: toCsv(rows),
    filename: buildFilename(filters),
    rowCount: rows.length,
  };
}

module.exports = {
  exportProgressCsv,
};
