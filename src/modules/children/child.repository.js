const { db } = require('../../config/database');

function baseChildSelect(whereClause) {
  return `
    SELECT
      children.id,
      children.first_name,
      children.last_name,
      children.avatar_path,
      children.access_code_hash,
      children.group_id,
      children.parish_id,
      children.catechesis_level_id,
      children.is_active,
      groups.name AS group_name,
      groups.catechist_id,
      parishes.name AS parish_name,
      catechesis_levels.name AS catechesis_level_name
    FROM children
    INNER JOIN groups ON groups.id = children.group_id
    INNER JOIN parishes ON parishes.id = children.parish_id
    INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
    ${whereClause}
  `;
}

function listChildren() {
  return db
    .prepare(
      `
        ${baseChildSelect('WHERE children.deleted_at IS NULL')}
        ORDER BY children.is_active DESC, children.last_name ASC, children.first_name ASC
      `,
    )
    .all();
}

function listChildrenByCatechist(catechistId) {
  return db
    .prepare(
      `
        ${baseChildSelect('WHERE children.deleted_at IS NULL AND groups.catechist_id = ?')}
        ORDER BY children.is_active DESC, children.last_name ASC, children.first_name ASC
      `,
    )
    .all(catechistId);
}


function listChildrenByParish(parishId) {
  return db
    .prepare(
      `
        ${baseChildSelect('WHERE children.deleted_at IS NULL AND children.parish_id = ?')}
        ORDER BY children.is_active DESC, groups.name ASC, children.last_name ASC, children.first_name ASC
      `,
    )
    .all(parishId);
}

function findChildById(id) {
  return db
    .prepare(
      `
        ${baseChildSelect('WHERE children.id = ? AND children.deleted_at IS NULL')}
        LIMIT 1
      `,
    )
    .get(id);
}

function getChildAccessCodeHash(id) {
  return db
    .prepare(
      `
        SELECT access_code_hash
        FROM children
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function listActiveChildrenWithAccessCodes() {
  return db
    .prepare(
      `
        ${baseChildSelect(`
          WHERE children.deleted_at IS NULL
            AND children.is_active = 1
            AND children.access_code_hash IS NOT NULL
            AND groups.is_active = 1
            AND groups.deleted_at IS NULL
        `)}
      `,
    )
    .all();
}

function getChildProfile(id) {
  return db
    .prepare(
      `
        SELECT
          children.id,
          children.first_name,
          children.avatar_path,
          children.parish_id,
          children.catechesis_level_id,
          children.is_active,
          groups.name AS group_name,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name,
          COUNT(activity_attempts.id) AS total_attempts,
          COALESCE(SUM(CASE WHEN activity_attempts.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS completed_attempts
        FROM children
        INNER JOIN groups ON groups.id = children.group_id
        INNER JOIN parishes ON parishes.id = children.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
        LEFT JOIN activity_attempts ON activity_attempts.child_id = children.id
        WHERE children.id = ?
          AND children.deleted_at IS NULL
          AND children.is_active = 1
        GROUP BY children.id
        LIMIT 1
      `,
    )
    .get(id);
}

function listActivitiesForChild(childId) {
  return db
    .prepare(
      `
        SELECT
          activities.id,
          activities.title,
          activities.description,
          activities.activity_type,
          activities.points,
          activities.image_path,
          COUNT(DISTINCT questions.id) AS question_count
        FROM children
        INNER JOIN activities ON activities.catechesis_level_id = children.catechesis_level_id
        INNER JOIN questions ON questions.activity_id = activities.id
          AND questions.deleted_at IS NULL
          AND questions.is_active = 1
        WHERE children.id = ?
          AND children.deleted_at IS NULL
          AND children.is_active = 1
          AND activities.deleted_at IS NULL
          AND activities.is_active = 1
        GROUP BY activities.id
        ORDER BY activities.updated_at DESC, activities.id DESC
      `,
    )
    .all(childId);
}

function findActivityForChild(childId, activityId) {
  return db
    .prepare(
      `
        SELECT
          activities.id,
          activities.title,
          activities.description,
          activities.activity_type,
          activities.points,
          activities.image_path,
          children.first_name AS child_first_name,
          catechesis_levels.name AS catechesis_level_name
        FROM children
        INNER JOIN catechesis_levels ON catechesis_levels.id = children.catechesis_level_id
        INNER JOIN activities ON activities.catechesis_level_id = children.catechesis_level_id
        WHERE children.id = ?
          AND activities.id = ?
          AND children.deleted_at IS NULL
          AND children.is_active = 1
          AND activities.deleted_at IS NULL
          AND activities.is_active = 1
        LIMIT 1
      `,
    )
    .get(childId, activityId);
}

function listActivityQuestionsWithAnswers(activityId) {
  const questions = db
    .prepare(
      `
        SELECT id, prompt, question_type, display_order
        FROM questions
        WHERE activity_id = ?
          AND deleted_at IS NULL
          AND is_active = 1
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
        AND is_active = 1
      ORDER BY display_order ASC, id ASC
    `,
  );

  return questions.map((question) => ({
    ...question,
    answers: answersQuery.all(question.id),
  }));
}

function findAnswerForQuestion(questionId, answerId) {
  return db
    .prepare(
      `
        SELECT
          answers.id,
          answers.text,
          answers.is_correct,
          questions.activity_id,
          questions.prompt
        FROM answers
        INNER JOIN questions ON questions.id = answers.question_id
        WHERE answers.id = ?
          AND answers.question_id = ?
          AND answers.deleted_at IS NULL
          AND answers.is_active = 1
          AND questions.deleted_at IS NULL
          AND questions.is_active = 1
        LIMIT 1
      `,
    )
    .get(answerId, questionId);
}

function findOpenActivityAttempt(childId, activityId) {
  return db
    .prepare(
      `
        SELECT id, activity_id, child_id, score, total_questions, correct_answers, completed_at
        FROM activity_attempts
        WHERE child_id = ?
          AND activity_id = ?
          AND completed_at IS NULL
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(childId, activityId);
}

function createActivityAttempt(childId, activityId, totalQuestions) {
  const result = db
    .prepare(
      `
        INSERT INTO activity_attempts (activity_id, child_id, total_questions)
        VALUES (?, ?, ?)
      `,
    )
    .run(activityId, childId, totalQuestions);

  return result.lastInsertRowid;
}

function findQuestionAttempt(activityAttemptId, questionId) {
  return db
    .prepare(
      `
        SELECT id, activity_attempt_id, question_id, answer_id, is_correct
        FROM question_attempts
        WHERE activity_attempt_id = ?
          AND question_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(activityAttemptId, questionId);
}

function createQuestionAttempt(activityAttemptId, questionId, answerId, isCorrect) {
  const result = db
    .prepare(
      `
        INSERT INTO question_attempts (
          activity_attempt_id,
          question_id,
          answer_id,
          is_correct
        )
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(activityAttemptId, questionId, answerId, isCorrect ? 1 : 0);

  return result.lastInsertRowid;
}

function updateQuestionAttempt(id, answerId, isCorrect) {
  return db
    .prepare(
      `
        UPDATE question_attempts
        SET answer_id = ?,
            is_correct = ?
        WHERE id = ?
      `,
    )
    .run(answerId, isCorrect ? 1 : 0, id);
}

function saveQuestionAttempt(activityAttemptId, questionId, answerId, isCorrect) {
  const existingAttempt = findQuestionAttempt(activityAttemptId, questionId);

  if (existingAttempt) {
    updateQuestionAttempt(existingAttempt.id, answerId, isCorrect);
    return existingAttempt.id;
  }

  return createQuestionAttempt(activityAttemptId, questionId, answerId, isCorrect);
}

function getAttemptProgress(activityAttemptId) {
  return db
    .prepare(
      `
        SELECT
          COUNT(*) AS answered_questions,
          COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_answers
        FROM question_attempts
        WHERE activity_attempt_id = ?
      `,
    )
    .get(activityAttemptId);
}

function completeActivityAttempt(id, score, totalQuestions, correctAnswers) {
  return db
    .prepare(
      `
        UPDATE activity_attempts
        SET score = ?,
            total_questions = ?,
            correct_answers = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND completed_at IS NULL
      `,
    )
    .run(score, totalQuestions, correctAnswers, id);
}

function listActiveGroups() {
  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.parish_id,
          groups.catechesis_level_id,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        WHERE groups.is_active = 1
          AND groups.deleted_at IS NULL
        ORDER BY groups.name ASC
      `,
    )
    .all();
}

function listActiveGroupsByCatechist(catechistId) {
  return db
    .prepare(
      `
        SELECT
          groups.id,
          groups.name,
          groups.parish_id,
          groups.catechesis_level_id,
          groups.catechist_id,
          parishes.name AS parish_name,
          catechesis_levels.name AS catechesis_level_name
        FROM groups
        INNER JOIN parishes ON parishes.id = groups.parish_id
        INNER JOIN catechesis_levels ON catechesis_levels.id = groups.catechesis_level_id
        WHERE groups.is_active = 1
          AND groups.deleted_at IS NULL
          AND groups.catechist_id = ?
        ORDER BY groups.name ASC
      `,
    )
    .all(catechistId);
}

function findActiveGroupById(id) {
  return db
    .prepare(
      `
        SELECT id, parish_id, catechesis_level_id, catechist_id, name
        FROM groups
        WHERE id = ?
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
    )
    .get(id);
}

function createChild(child) {
  const result = db
    .prepare(
      `
        INSERT INTO children (
          group_id,
          parish_id,
          catechesis_level_id,
          first_name,
          last_name,
          avatar_path,
          access_code_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      child.groupId,
      child.parishId,
      child.catechesisLevelId,
      child.firstName,
      child.lastName,
      child.avatarPath,
      child.accessCodeHash,
    );

  return result.lastInsertRowid;
}

function updateChild(child) {
  return db
    .prepare(
      `
        UPDATE children
        SET group_id = ?,
            parish_id = ?,
            catechesis_level_id = ?,
            first_name = ?,
            last_name = ?,
            avatar_path = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(
      child.groupId,
      child.parishId,
      child.catechesisLevelId,
      child.firstName,
      child.lastName,
      child.avatarPath,
      child.id,
    );
}

function updateAccessCodeHash(id, accessCodeHash) {
  return db
    .prepare(
      `
        UPDATE children
        SET access_code_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .run(accessCodeHash, id);
}

function createChildRememberToken(token) {
  const result = db
    .prepare(
      `
        INSERT INTO child_remember_tokens (
          child_id,
          selector,
          token_hash,
          user_agent,
          ip_address,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      token.childId,
      token.selector,
      token.tokenHash,
      token.userAgent || null,
      token.ipAddress || null,
      token.expiresAt,
    );

  return result.lastInsertRowid;
}

function findActiveChildRememberToken(selector) {
  return db
    .prepare(
      `
        SELECT
          child_remember_tokens.id,
          child_remember_tokens.child_id,
          child_remember_tokens.selector,
          child_remember_tokens.token_hash,
          child_remember_tokens.expires_at,
          children.first_name
        FROM child_remember_tokens
        INNER JOIN children ON children.id = child_remember_tokens.child_id
        INNER JOIN groups ON groups.id = children.group_id
        WHERE child_remember_tokens.selector = ?
          AND child_remember_tokens.revoked_at IS NULL
          AND child_remember_tokens.expires_at > CURRENT_TIMESTAMP
          AND children.deleted_at IS NULL
          AND children.is_active = 1
          AND groups.deleted_at IS NULL
          AND groups.is_active = 1
        LIMIT 1
      `,
    )
    .get(selector);
}

function touchChildRememberToken(id) {
  return db
    .prepare(
      `
        UPDATE child_remember_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND revoked_at IS NULL
      `,
    )
    .run(id);
}

function revokeChildRememberToken(selector) {
  return db
    .prepare(
      `
        UPDATE child_remember_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE selector = ?
          AND revoked_at IS NULL
      `,
    )
    .run(selector);
}

function revokeChildRememberTokens(childId) {
  return db
    .prepare(
      `
        UPDATE child_remember_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE child_id = ?
          AND revoked_at IS NULL
      `,
    )
    .run(childId);
}

function deactivateChild(id) {
  return db
    .prepare(
      `
        UPDATE children
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
  createChildRememberToken,
  createAuditLog,
  createActivityAttempt,
  createChild,
  completeActivityAttempt,
  deactivateChild,
  findActivityForChild,
  findActiveGroupById,
  findAnswerForQuestion,
  findChildById,
  findOpenActivityAttempt,
  findQuestionAttempt,
  findActiveChildRememberToken,
  revokeChildRememberToken,
  revokeChildRememberTokens,
  touchChildRememberToken,
  getChildAccessCodeHash,
  getChildProfile,
  getAttemptProgress,
  listActivitiesForChild,
  listActivityQuestionsWithAnswers,
  listActiveChildrenWithAccessCodes,
  listActiveGroups,
  listActiveGroupsByCatechist,
  listChildren,
  listChildrenByCatechist,
  listChildrenByParish,
  runInTransaction,
  saveQuestionAttempt,
  updateAccessCodeHash,
  updateChild,
  updateQuestionAttempt,
};
