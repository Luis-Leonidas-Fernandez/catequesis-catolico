const { db } = require('../../config/database');

function listActivities() {
  return db
    .prepare(
      `
        SELECT
          activities.id,
          activities.title,
          activities.activity_type,
          activities.points,
          activities.is_active,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(DISTINCT questions.id) AS question_count
        FROM activities
        INNER JOIN catechesis_levels ON catechesis_levels.id = activities.catechesis_level_id
        LEFT JOIN questions ON questions.activity_id = activities.id AND questions.deleted_at IS NULL
        WHERE activities.deleted_at IS NULL
        GROUP BY activities.id
        ORDER BY activities.is_active DESC, activities.updated_at DESC
      `,
    )
    .all();
}

function listActivitiesByLevel(catechesisLevelId) {
  return db
    .prepare(
      `
        SELECT
          activities.id,
          activities.title,
          activities.activity_type,
          activities.points,
          activities.is_active,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(DISTINCT questions.id) AS question_count
        FROM activities
        INNER JOIN catechesis_levels ON catechesis_levels.id = activities.catechesis_level_id
        LEFT JOIN questions ON questions.activity_id = activities.id AND questions.deleted_at IS NULL
        WHERE activities.deleted_at IS NULL
          AND activities.catechesis_level_id = ?
        GROUP BY activities.id
        ORDER BY activities.is_active DESC, activities.updated_at DESC
      `,
    )
    .all(catechesisLevelId);
}

function listActiveCatechesisLevels() {
  return db
    .prepare(
      `
        SELECT id, name
        FROM catechesis_levels
        WHERE is_active = 1
          AND deleted_at IS NULL
        ORDER BY display_order ASC, name ASC
      `,
    )
    .all();
}

function findLevelByName(name) {
  return db
    .prepare(
      `
        SELECT id, name
        FROM catechesis_levels
        WHERE name = ?
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(name);
}

function findActivityById(id) {
  return db
    .prepare(
      `
        SELECT
          id,
          catechesis_level_id,
          title,
          description,
          activity_type,
          points,
          image_path,
          media_asset_id,
          is_active
        FROM activities
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function listQuestionsWithAnswers(activityId) {
  const questions = db
    .prepare(
      `
        SELECT id, prompt, question_type, display_order
        FROM questions
        WHERE activity_id = ?
          AND deleted_at IS NULL
        ORDER BY display_order ASC, id ASC
      `,
    )
    .all(activityId);

  const answersQuery = db.prepare(
    `
      SELECT id, text, is_correct, display_order
      FROM answers
      WHERE question_id = ?
        AND deleted_at IS NULL
      ORDER BY display_order ASC, id ASC
    `,
  );

  return questions.map((question) => ({
    ...question,
    answers: answersQuery.all(question.id),
  }));
}

function createActivity(activity) {
  const result = db
    .prepare(
      `
        INSERT INTO activities (
          catechesis_level_id,
          title,
          description,
          activity_type,
          points,
          image_path,
          media_asset_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      activity.catechesisLevelId,
      activity.title,
      activity.description,
      activity.activityType,
      activity.points,
      activity.imagePath,
      activity.mediaAssetId || null,
    );

  return result.lastInsertRowid;
}

function updateActivity(activity) {
  return db
    .prepare(
      `
        UPDATE activities
        SET catechesis_level_id = ?,
            title = ?,
            description = ?,
            activity_type = ?,
            points = ?,
            image_path = ?,
            media_asset_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(
      activity.catechesisLevelId,
      activity.title,
      activity.description,
      activity.activityType,
      activity.points,
      activity.imagePath,
      activity.mediaAssetId || null,
      activity.id,
    );
}

function createQuestion(activityId, question) {
  const result = db
    .prepare(
      `
        INSERT INTO questions (activity_id, prompt, question_type, display_order)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(activityId, question.prompt, 'single_choice', question.displayOrder);

  return result.lastInsertRowid;
}

function createAnswer(questionId, answer) {
  return db
    .prepare(
      `
        INSERT INTO answers (question_id, text, is_correct, display_order)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(questionId, answer.text, answer.isCorrect ? 1 : 0, answer.displayOrder);
}

function softDeleteQuestionsAndAnswers(activityId) {
  const questionIds = db
    .prepare('SELECT id FROM questions WHERE activity_id = ? AND deleted_at IS NULL')
    .all(activityId)
    .map((question) => question.id);

  for (const questionId of questionIds) {
    db.prepare(
      `
        UPDATE answers
        SET deleted_at = CURRENT_TIMESTAMP,
            is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE question_id = ?
          AND deleted_at IS NULL
      `,
    ).run(questionId);
  }

  db.prepare(
    `
      UPDATE questions
      SET deleted_at = CURRENT_TIMESTAMP,
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE activity_id = ?
        AND deleted_at IS NULL
    `,
  ).run(activityId);
}

function deactivateActivity(id) {
  return db
    .prepare(
      `
        UPDATE activities
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(id);
}

function createAuditLog(entry) {
  return db
    .prepare(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );
}

function runInTransaction(callback) {
  return db.transaction(callback)();
}

module.exports = {
  createActivity,
  createAnswer,
  createAuditLog,
  createQuestion,
  deactivateActivity,
  findActivityById,
  findLevelByName,
  listActivities,
  listActivitiesByLevel,
  listActiveCatechesisLevels,
  listQuestionsWithAnswers,
  runInTransaction,
  softDeleteQuestionsAndAnswers,
  updateActivity,
};
