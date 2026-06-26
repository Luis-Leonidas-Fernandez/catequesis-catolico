const { db } = require('../../config/database');

function getChildProgress(childId) {
  return db
    .prepare(
      `
        SELECT
          children.id,
          children.first_name,
          children.avatar_path,
          groups.name AS group_name,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(DISTINCT activities.id) AS available_activities,
          COUNT(DISTINCT CASE WHEN activity_attempts.completed_at IS NOT NULL THEN activity_attempts.activity_id END) AS completed_activities,
          COUNT(DISTINCT activity_attempts.id) AS total_attempts,
          COALESCE(SUM(activity_attempts.correct_answers), 0) AS correct_answers,
          COALESCE(SUM(activity_attempts.total_questions - activity_attempts.correct_answers), 0) AS incorrect_answers,
          MAX(activity_attempts.created_at) AS last_access_at
        FROM children
        INNER JOIN groups ON groups.id = children.group_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
        LEFT JOIN activities ON activities.catechesis_level_id = children.catechesis_level_id
          AND activities.is_active = 1
          AND activities.deleted_at IS NULL
        LEFT JOIN activity_attempts ON activity_attempts.child_id = children.id
          AND activity_attempts.activity_id = activities.id
        WHERE children.id = ?
          AND children.is_active = 1
          AND children.deleted_at IS NULL
        GROUP BY children.id
        LIMIT 1
      `,
    )
    .get(childId);
}

function listChildCompletedActivities(childId) {
  return db
    .prepare(
      `
        SELECT
          activities.title,
          activity_attempts.score,
          activity_attempts.total_questions,
          activity_attempts.correct_answers,
          activity_attempts.completed_at
        FROM activity_attempts
        INNER JOIN activities ON activities.id = activity_attempts.activity_id
        WHERE activity_attempts.child_id = ?
          AND activity_attempts.completed_at IS NOT NULL
        ORDER BY activity_attempts.completed_at DESC, activity_attempts.id DESC
      `,
    )
    .all(childId);
}

function listGroupsForUser(user) {
  const params = [];
  let where = 'WHERE groups.deleted_at IS NULL';

  if (user.role === 'catequista_familiar' || user.role === 'catequista_juvenil') {
    where += ' AND groups.catechist_id = ?';
    params.push(user.id);
  }

  if (user.role === 'coordinador_parroquial' || user.role === 'coordinador_zonal') {
    where += ' AND groups.parish_id = ?';
    params.push(user.parishId || 0);
  }

  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.year,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name,
          users.name AS catechist_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        LEFT JOIN users ON users.id = groups.catechist_id
        ${where}
        ORDER BY groups.year DESC, groups.name ASC
      `,
    )
    .all(...params);
}

function listChildrenProgressForUser(user) {
  const params = [];
  let where = `
    WHERE children.deleted_at IS NULL
      AND groups.deleted_at IS NULL
  `;

  if (user.role === 'catequista_familiar' || user.role === 'catequista_juvenil') {
    where += ' AND groups.catechist_id = ?';
    params.push(user.id);
  }

  if (user.role === 'coordinador_parroquial' || user.role === 'coordinador_zonal') {
    where += ' AND groups.parish_id = ?';
    params.push(user.parishId || 0);
  }

  return db
    .prepare(
      `
        SELECT
          children.id,
          children.first_name,
          children.last_name,
          children.is_active,
          groups.id AS group_id,
          groups.name AS group_name,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(DISTINCT activities.id) AS available_activities,
          COUNT(DISTINCT CASE WHEN activity_attempts.completed_at IS NOT NULL THEN activity_attempts.activity_id END) AS completed_activities,
          COUNT(DISTINCT activity_attempts.id) AS total_attempts,
          COALESCE(SUM(activity_attempts.correct_answers), 0) AS correct_answers,
          COALESCE(SUM(activity_attempts.total_questions - activity_attempts.correct_answers), 0) AS incorrect_answers,
          MAX(activity_attempts.created_at) AS last_access_at
        FROM children
        INNER JOIN groups ON groups.id = children.group_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
        LEFT JOIN activities ON activities.catechesis_level_id = children.catechesis_level_id
          AND activities.is_active = 1
          AND activities.deleted_at IS NULL
        LEFT JOIN activity_attempts ON activity_attempts.child_id = children.id
          AND activity_attempts.activity_id = activities.id
        ${where}
        GROUP BY children.id
        ORDER BY groups.name ASC, children.last_name ASC, children.first_name ASC
      `,
    )
    .all(...params);
}

module.exports = {
  getChildProgress,
  listChildCompletedActivities,
  listChildrenProgressForUser,
  listGroupsForUser,
};
