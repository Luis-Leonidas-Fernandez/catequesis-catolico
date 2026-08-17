const activityRepository = require('./activity.repository');
const mediaService = require('../media/media.service');
const activityAuthorization = require('./activity.authorization');
const { isAdmin } = require('../auth/role-permissions');

function getAllowedLevels(user) {
  return activityAuthorization.getAllowedLevels(user);
}

function canManageActivities(user) {
  return activityAuthorization.canManageActivities(user);
}

function canManageLevel(user, catechesisLevelId) {
  return activityAuthorization.canManageActivityLevel(user, catechesisLevelId);
}

function listActivities(user) {
  if (isAdmin(user)) {
    return activityRepository.listActivities();
  }

  const allowedLevels = getAllowedLevels(user);
  if (allowedLevels.length === 0) {
    return [];
  }

  return activityRepository.listActivitiesByLevels(allowedLevels.map((level) => level.id));
}

function getActivityForEdit(id, user) {
  const activity = activityRepository.findActivityById(id);

  if (!activity || !canManageLevel(user, activity.catechesis_level_id)) {
    return null;
  }

  return {
    ...activity,
    questions: activityRepository.listQuestionsWithAnswers(activity.id),
  };
}

function persistQuestions(activityId, questions) {
  for (const question of questions) {
    const questionId = activityRepository.createQuestion(activityId, question);

    for (const answer of question.answers) {
      activityRepository.createAnswer(questionId, answer);
    }
  }
}

function createActivity(input, actor) {
  if (!canManageLevel(actor, input.catechesisLevelId)) {
    return {
      ok: false,
      errors: {
        catechesisLevelId: 'No tenés permiso para crear actividades en ese nivel.',
      },
    };
  }

  const activityId = activityRepository.runInTransaction(() => {
    const createdActivityId = activityRepository.createActivity(input);
    if (input.mediaAssetId) {
      mediaService.updateMediaAssetOwner(input.mediaAssetId, 'activities', createdActivityId);
    }
    persistQuestions(createdActivityId, input.questions);

    activityRepository.createAuditLog({
      userId: actor.id,
      action: 'activity_created',
      entityType: 'activities',
      entityId: createdActivityId,
      metadata: {
        catechesisLevelId: input.catechesisLevelId,
        activityType: input.activityType,
        questionCount: input.questions.length,
      },
    });

    return createdActivityId;
  });

  return {
    ok: true,
    activityId,
  };
}

function updateActivity(id, input, actor) {
  const activity = getActivityForEdit(id, actor);

  if (!activity) {
    return {
      ok: false,
      notFound: true,
    };
  }

  if (!canManageLevel(actor, input.catechesisLevelId)) {
    return {
      ok: false,
      errors: {
        catechesisLevelId: 'No tenés permiso para editar actividades en ese nivel.',
      },
    };
  }

  activityRepository.runInTransaction(() => {
    activityRepository.updateActivity({
      id,
      ...input,
    });
    if (input.mediaAssetId) {
      mediaService.updateMediaAssetOwner(input.mediaAssetId, 'activities', id);
    }
    activityRepository.softDeleteQuestionsAndAnswers(id);
    persistQuestions(id, input.questions);

    activityRepository.createAuditLog({
      userId: actor.id,
      action: 'activity_updated',
      entityType: 'activities',
      entityId: id,
      metadata: {
        catechesisLevelId: input.catechesisLevelId,
        activityType: input.activityType,
        questionCount: input.questions.length,
      },
    });
  });

  return {
    ok: true,
  };
}

function deactivateActivity(id, actor) {
  const activity = getActivityForEdit(id, actor);

  if (!activity) {
    return {
      ok: false,
      notFound: true,
    };
  }

  activityRepository.runInTransaction(() => {
    activityRepository.deactivateActivity(id);

    activityRepository.createAuditLog({
      userId: actor.id,
      action: 'activity_deactivated',
      entityType: 'activities',
      entityId: id,
      metadata: {
        catechesisLevelId: activity.catechesis_level_id,
      },
    });
  });

  return {
    ok: true,
  };
}

module.exports = {
  canManageActivities,
  createActivity,
  deactivateActivity,
  getActivityForEdit,
  getAllowedLevels,
  listActivities,
  updateActivity,
};
