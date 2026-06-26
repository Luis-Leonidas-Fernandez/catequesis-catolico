const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { generateAccessCode } = require('./access-code');
const childRepository = require('./child.repository');
const { withAutoImageFormat } = require('../../utils/cloudinary-image');
const { ROLES } = require('../auth/roles');

const BCRYPT_SALT_ROUNDS = 10;
const CHILD_REMEMBER_DAYS = 30;
const REMEMBER_COOKIE_SEPARATOR = '.';

function isCatechist(user) {
  return user.role === ROLES.CATEQUISTA_FAMILIAR || user.role === ROLES.CATEQUISTA_JUVENIL;
}

function canManageChildren(user) {
  return user.role === ROLES.ADMIN;
}

function canAccessChild(user, child) {
  if (user.role === ROLES.ADMIN) {
    return true;
  }

  return isCatechist(user) && child.catechist_id === user.id;
}

function getAvailableGroups(user) {
  if (user.role === ROLES.ADMIN) {
    return childRepository.listActiveGroups();
  }

  if (isCatechist(user)) {
    return childRepository.listActiveGroupsByCatechist(user.id);
  }

  return [];
}

function listManageableChildren(user) {
  if (user.role === ROLES.ADMIN) {
    return childRepository.listChildren();
  }

  if (isCatechist(user)) {
    return childRepository.listChildrenByCatechist(user.id);
  }

  return [];
}

function getChildForEdit(id, user) {
  const child = childRepository.findChildById(id);

  if (!child || !canAccessChild(user, child)) {
    return null;
  }

  return child;
}

function validateGroupAccess(input, user) {
  const group = childRepository.findActiveGroupById(input.groupId);

  if (!group) {
    return {
      error: 'El grupo seleccionado no existe o no está activo.',
      group: null,
    };
  }

  if (user.role !== ROLES.ADMIN && (!isCatechist(user) || group.catechist_id !== user.id)) {
    return {
      error: 'No tenés permiso para gestionar niños en ese grupo.',
      group: null,
    };
  }

  return {
    error: null,
    group,
  };
}

async function hashAccessCode(accessCode) {
  return bcrypt.hash(accessCode, BCRYPT_SALT_ROUNDS);
}

function hashRememberToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function createRememberCookieValue() {
  const selector = crypto.randomBytes(12).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');

  return {
    selector,
    verifier,
    value: `${selector}${REMEMBER_COOKIE_SEPARATOR}${verifier}`,
  };
}

function parseRememberCookieValue(value) {
  const [selector, verifier, ...rest] = String(value || '').split(REMEMBER_COOKIE_SEPARATOR);

  if (!selector || !verifier || rest.length > 0) {
    return null;
  }

  return {
    selector,
    verifier,
  };
}

function createRememberToken(childId, context = {}) {
  const token = createRememberCookieValue();
  const expiresAt = toSqlDate(new Date(Date.now() + CHILD_REMEMBER_DAYS * 24 * 60 * 60 * 1000));

  childRepository.createChildRememberToken({
    childId,
    selector: token.selector,
    tokenHash: hashRememberToken(token.verifier),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    expiresAt,
  });

  return {
    value: token.value,
    maxAge: CHILD_REMEMBER_DAYS * 24 * 60 * 60 * 1000,
    expiresAt,
  };
}

function authenticateRememberToken(cookieValue) {
  const parsedToken = parseRememberCookieValue(cookieValue);

  if (!parsedToken) {
    return null;
  }

  const storedToken = childRepository.findActiveChildRememberToken(parsedToken.selector);

  if (!storedToken) {
    return null;
  }

  const expectedHash = Buffer.from(storedToken.token_hash, 'hex');
  const actualHash = Buffer.from(hashRememberToken(parsedToken.verifier), 'hex');

  if (expectedHash.length !== actualHash.length || !crypto.timingSafeEqual(expectedHash, actualHash)) {
    childRepository.revokeChildRememberToken(parsedToken.selector);
    return null;
  }

  childRepository.touchChildRememberToken(storedToken.id);

  return {
    id: storedToken.child_id,
    firstName: storedToken.first_name,
    selector: storedToken.selector,
  };
}

function revokeRememberToken(cookieValue) {
  const parsedToken = parseRememberCookieValue(cookieValue);

  if (!parsedToken) {
    return;
  }

  childRepository.revokeChildRememberToken(parsedToken.selector);
}

async function createChild(input, actor) {
  const groupAccess = validateGroupAccess(input, actor);

  if (groupAccess.error) {
    return {
      ok: false,
      errors: {
        groupId: groupAccess.error,
      },
    };
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = await hashAccessCode(accessCode);

  const childId = childRepository.runInTransaction(() => {
    const createdChildId = childRepository.createChild({
      ...input,
      parishId: groupAccess.group.parish_id,
      catechesisLevelId: groupAccess.group.catechesis_level_id,
      accessCodeHash,
    });

    childRepository.createAuditLog({
      userId: actor.id,
      action: 'child_created',
      entityType: 'children',
      entityId: createdChildId,
      metadata: {
        groupId: input.groupId,
        parishId: groupAccess.group.parish_id,
        catechesisLevelId: groupAccess.group.catechesis_level_id,
        accessCodeGenerated: true,
      },
    });

    return createdChildId;
  });

  return {
    ok: true,
    childId,
    accessCode,
  };
}

function updateChild(id, input, actor) {
  const child = getChildForEdit(id, actor);

  if (!child) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const groupAccess = validateGroupAccess(input, actor);

  if (groupAccess.error) {
    return {
      ok: false,
      errors: {
        groupId: groupAccess.error,
      },
    };
  }

  childRepository.runInTransaction(() => {
    childRepository.updateChild({
      id,
      ...input,
      parishId: groupAccess.group.parish_id,
      catechesisLevelId: groupAccess.group.catechesis_level_id,
    });

    childRepository.createAuditLog({
      userId: actor.id,
      action: 'child_updated',
      entityType: 'children',
      entityId: id,
      metadata: {
        groupId: input.groupId,
        parishId: groupAccess.group.parish_id,
        catechesisLevelId: groupAccess.group.catechesis_level_id,
      },
    });
  });

  return {
    ok: true,
  };
}

function deactivateChild(id, actor) {
  const child = getChildForEdit(id, actor);

  if (!child) {
    return {
      ok: false,
      notFound: true,
    };
  }

  childRepository.runInTransaction(() => {
    childRepository.deactivateChild(id);
    childRepository.revokeChildRememberTokens(id);

    childRepository.createAuditLog({
      userId: actor.id,
      action: 'child_deactivated',
      entityType: 'children',
      entityId: id,
      metadata: {
        groupId: child.group_id,
        parishId: child.parish_id,
      },
    });
  });

  return {
    ok: true,
  };
}

async function regenerateAccessCode(id, actor) {
  const child = getChildForEdit(id, actor);

  if (!child) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = await hashAccessCode(accessCode);

  childRepository.runInTransaction(() => {
    childRepository.updateAccessCodeHash(id, accessCodeHash);
    childRepository.revokeChildRememberTokens(id);

    childRepository.createAuditLog({
      userId: actor.id,
      action: 'child_access_code_regenerated',
      entityType: 'children',
      entityId: id,
      metadata: {
        groupId: child.group_id,
        accessCodeGenerated: true,
      },
    });
  });

  return {
    ok: true,
    child,
    accessCode,
  };
}

function getAccessCodeHash(id) {
  const row = childRepository.getChildAccessCodeHash(id);
  return row ? row.access_code_hash : null;
}

async function authenticateChild(accessCode) {
  const normalizedCode = String(accessCode || '').trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const children = childRepository.listActiveChildrenWithAccessCodes();

  for (const child of children) {
    const matches = await bcrypt.compare(normalizedCode, child.access_code_hash);

    if (matches) {
      return {
        id: child.id,
        firstName: child.first_name,
      };
    }
  }

  return null;
}


function optimizeActivityImage(activity) {
  if (!activity) {
    return activity;
  }

  return {
    ...activity,
    image_path: withAutoImageFormat(activity.image_path || ''),
  };
}

function optimizeActivityImages(activities) {
  return activities.map(optimizeActivityImage);
}

function getChildProfile(childId) {
  return childRepository.getChildProfile(childId);
}

function listActivitiesForChild(childId) {
  const profile = childRepository.getChildProfile(childId);

  if (!profile) {
    return null;
  }

  return {
    profile,
    activities: optimizeActivityImages(childRepository.listActivitiesForChild(childId)),
  };
}

function getOrCreateActivityAttempt(childId, activityId, totalQuestions) {
  const existingAttempt = childRepository.findOpenActivityAttempt(childId, activityId);

  if (existingAttempt) {
    return existingAttempt;
  }

  const attemptId = childRepository.createActivityAttempt(childId, activityId, totalQuestions);

  return {
    id: attemptId,
    activity_id: activityId,
    child_id: childId,
    score: 0,
    total_questions: totalQuestions,
    correct_answers: 0,
    completed_at: null,
  };
}

function calculateScore(activityPoints, totalQuestions, correctAnswers) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return Math.round((correctAnswers / totalQuestions) * activityPoints);
}

function getActivityGame(childId, activityId, requestedQuestionIndex = 0, feedback = null) {
  const activity = optimizeActivityImage(childRepository.findActivityForChild(childId, activityId));

  if (!activity) {
    return null;
  }

  const questions = childRepository.listActivityQuestionsWithAnswers(activityId);

  if (questions.length === 0) {
    return null;
  }

  const questionIndex = Math.min(
    Math.max(Number.isInteger(requestedQuestionIndex) ? requestedQuestionIndex : 0, 0),
    questions.length - 1,
  );
  const attempt = getOrCreateActivityAttempt(childId, activity.id, questions.length);
  const progress = childRepository.getAttemptProgress(attempt.id);

  return {
    activity,
    attempt,
    progress,
    questions,
    currentQuestion: questions[questionIndex],
    currentQuestionIndex: questionIndex,
    totalQuestions: questions.length,
    nextQuestionIndex: questionIndex + 1 < questions.length ? questionIndex + 1 : null,
    feedback,
  };
}

function evaluateActivityAnswer(childId, activityId, input) {
  const questionId = Number(input.questionId);
  const answerId = Number(input.answerId);
  const questionIndex = Number(input.questionIndex);

  if (!Number.isInteger(questionId) || !Number.isInteger(answerId)) {
    return {
      ok: false,
      notFound: false,
      game: getActivityGame(childId, activityId, Number.isInteger(questionIndex) ? questionIndex : 0, {
        type: 'warning',
        message: 'Elegí una respuesta antes de continuar.',
      }),
    };
  }

  const game = getActivityGame(
    childId,
    activityId,
    Number.isInteger(questionIndex) ? questionIndex : 0,
  );

  if (!game) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const questionBelongsToActivity = game.questions.some((question) => question.id === questionId);

  if (!questionBelongsToActivity) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const answer = childRepository.findAnswerForQuestion(questionId, answerId);

  if (!answer || answer.activity_id !== Number(activityId)) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const isCorrect = answer.is_correct === 1;
  const savedGame = childRepository.runInTransaction(() => {
    childRepository.saveQuestionAttempt(game.attempt.id, questionId, answerId, isCorrect);

    const progress = childRepository.getAttemptProgress(game.attempt.id);
    const isLastQuestion = game.nextQuestionIndex === null;
    const isReadyToComplete = isCorrect && isLastQuestion && progress.answered_questions >= game.totalQuestions;
    const score = calculateScore(game.activity.points, game.totalQuestions, progress.correct_answers);

    if (isReadyToComplete) {
      childRepository.completeActivityAttempt(
        game.attempt.id,
        score,
        game.totalQuestions,
        progress.correct_answers,
      );
    }

    return {
      ...game,
      progress,
      feedback: {
        type: isCorrect ? 'success' : 'danger',
        isCorrect,
        isCompleted: isReadyToComplete,
        score,
        correctAnswers: progress.correct_answers,
        message: isCorrect
          ? '¡Correcto! Muy bien, seguí así.'
          : 'Casi. Intentá nuevamente, tranquilo: aprender también es volver a probar.',
      },
    };
  });

  return {
    ok: true,
    game: savedGame,
  };
}

module.exports = {
  canManageChildren,
  authenticateChild,
  createChild,
  deactivateChild,
  evaluateActivityAnswer,
  getAccessCodeHash,
  getActivityGame,
  getChildProfile,
  getAvailableGroups,
  getChildForEdit,
  listActivitiesForChild,
  listManageableChildren,
  authenticateRememberToken,
  createRememberToken,
  revokeRememberToken,
  regenerateAccessCode,
  updateChild,
};
