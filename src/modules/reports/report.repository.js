const { db } = require('../../config/database');

function buildReportWhere(filters, user) {
  const where = [
    'children.deleted_at IS NULL',
    'groups.deleted_at IS NULL',
    'activities.deleted_at IS NULL',
  ];
  const attemptFilters = [];
  const params = {};

  if (user.role === 'catequista_familiar' || user.role === 'catequista_juvenil') {
    where.push('groups.catechist_id = @scopeCatechistId');
    params.scopeCatechistId = user.id;
  }

  if (user.role === 'coordinador_parroquial') {
    where.push('groups.parish_id = @scopeParishId');
    params.scopeParishId = user.parishId || 0;
  }

  if (user.role === 'coordinador_zonal') {
    where.push('groups.parish_id = @scopeParishId');
    params.scopeParishId = user.parishId || 0;
  }

  if (filters.catechistId) {
    where.push('groups.catechist_id = @catechistId');
    params.catechistId = filters.catechistId;
  }

  if (filters.groupId) {
    where.push('groups.id = @groupId');
    params.groupId = filters.groupId;
  }

  if (filters.catechesisLevelId) {
    where.push('children.catechesis_level_id = @catechesisLevelId');
    params.catechesisLevelId = filters.catechesisLevelId;
  }

  if (filters.activityId) {
    where.push('activities.id = @activityId');
    params.activityId = filters.activityId;
  }

  if (filters.startDate) {
    attemptFilters.push('activity_attempts.created_at >= @startDate');
    params.startDate = `${filters.startDate} 00:00:00`;
  }

  if (filters.endDate) {
    attemptFilters.push('activity_attempts.created_at <= @endDate');
    params.endDate = `${filters.endDate} 23:59:59`;
  }

  return {
    whereSql: where.join('\n          AND '),
    attemptFilterSql: attemptFilters.length ? `AND ${attemptFilters.join('\n          AND ')}` : '',
    params,
  };
}

function listProgressRows(filters, user) {
  const { whereSql, attemptFilterSql, params } = buildReportWhere(filters, user);

  return db
    .prepare(
      `
        SELECT
          children.first_name || ' ' || children.last_name AS child_name,
          groups.name AS group_name,
          COALESCE(catechists.name, 'Sin asignar') AS catechist_name,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(DISTINCT activities.id) AS available_activities,
          COUNT(DISTINCT CASE WHEN activity_attempts.completed_at IS NOT NULL THEN activity_attempts.activity_id END) AS completed_activities,
          COALESCE(SUM(activity_attempts.correct_answers), 0) AS correct_answers,
          COALESCE(SUM(activity_attempts.total_questions - activity_attempts.correct_answers), 0) AS incorrect_answers,
          CASE
            WHEN COUNT(DISTINCT activities.id) = 0 THEN 0
            ELSE ROUND(
              COUNT(DISTINCT CASE WHEN activity_attempts.completed_at IS NOT NULL THEN activity_attempts.activity_id END) * 100.0 /
              COUNT(DISTINCT activities.id)
            )
          END AS progress_percentage,
          COALESCE(
            (
              SELECT recent_activities.title
              FROM activity_attempts recent_attempts
              INNER JOIN activities recent_activities ON recent_activities.id = recent_attempts.activity_id
              WHERE recent_attempts.child_id = children.id
                AND recent_activities.deleted_at IS NULL
                ${filters.activityId ? 'AND recent_activities.id = @activityId' : ''}
                ${filters.startDate ? 'AND recent_attempts.created_at >= @startDate' : ''}
                ${filters.endDate ? 'AND recent_attempts.created_at <= @endDate' : ''}
              ORDER BY recent_attempts.created_at DESC, recent_attempts.id DESC
              LIMIT 1
            ),
            ''
          ) AS last_activity,
          COALESCE(MAX(activity_attempts.created_at), '') AS last_access_at
        FROM children
        INNER JOIN groups ON groups.id = children.group_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
        LEFT JOIN users catechists ON catechists.id = groups.catechist_id
        LEFT JOIN activities ON activities.catechesis_level_id = children.catechesis_level_id
          AND activities.is_active = 1
          AND activities.deleted_at IS NULL
        LEFT JOIN activity_attempts ON activity_attempts.child_id = children.id
          AND activity_attempts.activity_id = activities.id
          ${attemptFilterSql}
        WHERE ${whereSql}
        GROUP BY children.id
        ORDER BY groups.name ASC, children.last_name ASC, children.first_name ASC
      `,
    )
    .all(params);
}

module.exports = {
  listProgressRows,
};
