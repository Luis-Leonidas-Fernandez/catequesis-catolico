const { ACTIVITY_TYPES } = require('./activity.constants');
const activityService = require('./activity.service');
const {
  deleteUploadedActivityImage,
  validateUploadedActivityImage,
} = require('./activity-image-upload');
const { validateActivity } = require('./activity.validators');
const { withAutoImageFormat } = require('../../utils/cloudinary-image');
const escapeHtml = require('../../utils/escape-html');

function blankQuestions() {
  return [0, 1, 2].map((index) => ({
    prompt: '',
    displayOrder: index,
    answers: [0, 1, 2, 3].map((answerIndex) => ({
      text: '',
      isCorrect: false,
      displayOrder: answerIndex,
    })),
  }));
}

function normalizeQuestionsForForm(questions) {
  const normalized = blankQuestions();

  questions.forEach((question, index) => {
    if (index >= normalized.length) {
      return;
    }

    normalized[index] = {
      prompt: question.prompt,
      displayOrder: index,
      answers: normalized[index].answers.map((answer, answerIndex) => {
        const existingAnswer = question.answers[answerIndex];
        return existingAnswer
          ? {
              text: existingAnswer.text,
              isCorrect: Boolean(existingAnswer.isCorrect || existingAnswer.is_correct),
              displayOrder: answerIndex,
            }
          : answer;
      }),
    };
  });

  return normalized;
}

function buildFormViewModel(currentUser, overrides = {}) {
  return {
    errors: {},
    activity: {
      title: '',
      description: '',
      activityType: 'question_answer',
      catechesisLevelId: '',
      points: 10,
      imagePath: '',
      mediaAssetId: '',
      questions: blankQuestions(),
    },
    activityTypes: ACTIVITY_TYPES,
    catechesisLevels: activityService.getAllowedLevels(currentUser),
    ...overrides,
  };
}

function inputToFormActivity(input) {
  return {
    title: input.title,
    description: input.description || '',
    activityType: input.activityType,
    catechesisLevelId: input.catechesisLevelId || '',
    points: input.points,
    imagePath: input.imagePath || '',
    mediaAssetId: input.mediaAssetId || '',
    questions: normalizeQuestionsForForm(input.questions),
  };
}

function showActivities(req, res) {
  return res.render('admin/activities/index', {
    title: 'Actividades',
    user: res.locals.currentUser,
    activities: activityService.listActivities(res.locals.currentUser),
    csrfToken: res.locals.csrfToken,
    message: req.query.message || '',
    error: req.query.error || '',
    escapeHtml,
  });
}

function showNewActivity(req, res) {
  return res.render('admin/activities/form', {
    title: 'Nueva actividad',
    user: res.locals.currentUser,
    formAction: '/admin/activities',
    formTitle: 'Crear actividad',
    submitLabel: 'Crear actividad',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(res.locals.currentUser),
  });
}

function renderFormWithErrors(res, status, config, currentUser, validation, resultErrors = {}) {
  return res.status(status).render('admin/activities/form', {
    title: config.title,
    user: currentUser,
    formAction: config.formAction,
    formTitle: config.formTitle,
    submitLabel: config.submitLabel,
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(currentUser, {
      errors: {
        ...validation.errors,
        ...resultErrors,
      },
      activity: inputToFormActivity(validation.input),
    }),
  });
}

async function validateImageUpload(req, currentUser) {
  if (req.uploadError) {
    return {
      ok: false,
      errors: {
        imageFile: req.uploadError,
      },
    };
  }

  const imageValidation = await validateUploadedActivityImage(req.file, currentUser);

  if (!imageValidation.ok) {
    return {
      ok: false,
      errors: {
        imageFile: imageValidation.error,
      },
    };
  }

  if (imageValidation.imagePath) {
    req.body.imagePath = imageValidation.imagePath;
    req.body.mediaAssetId = imageValidation.mediaAssetId;
  }

  return {
    ok: true,
  };
}

async function createActivity(req, res, next) {
  try {
    const imageValidation = await validateImageUpload(req, res.locals.currentUser);
    const validation = validateActivity(req.body);

    if (!imageValidation.ok || !validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nueva actividad',
          formAction: '/admin/activities',
          formTitle: 'Crear actividad',
          submitLabel: 'Crear actividad',
        },
        res.locals.currentUser,
        validation,
        imageValidation.errors,
      );
    }

    const result = activityService.createActivity(validation.input, res.locals.currentUser);

    if (!result.ok) {
      deleteUploadedActivityImage(req.file);

      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Nueva actividad',
          formAction: '/admin/activities',
          formTitle: 'Crear actividad',
          submitLabel: 'Crear actividad',
        },
        res.locals.currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/admin/activities?message=Actividad%20creada');
  } catch (error) {
    return next(error);
  }
}

function showEditActivity(req, res, next) {
  const activity = activityService.getActivityForEdit(Number(req.params.id), res.locals.currentUser);

  if (!activity) {
    return next();
  }

  return res.render('admin/activities/form', {
    title: 'Editar actividad',
    user: res.locals.currentUser,
    formAction: `/admin/activities/${activity.id}`,
    formTitle: 'Editar actividad',
    submitLabel: 'Guardar cambios',
    csrfToken: res.locals.csrfToken,
    escapeHtml,
    ...buildFormViewModel(res.locals.currentUser, {
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description || '',
        activityType: activity.activity_type,
        catechesisLevelId: activity.catechesis_level_id,
        points: activity.points,
        imagePath: withAutoImageFormat(activity.image_path || ''),
        mediaAssetId: activity.media_asset_id || '',
        questions: normalizeQuestionsForForm(activity.questions),
      },
    }),
  });
}

async function updateActivity(req, res, next) {
  try {
    const activityId = Number(req.params.id);
    const imageValidation = await validateImageUpload(req, res.locals.currentUser);
    const validation = validateActivity(req.body);

    if (!imageValidation.ok || !validation.isValid) {
      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar actividad',
          formAction: `/admin/activities/${activityId}`,
          formTitle: 'Editar actividad',
          submitLabel: 'Guardar cambios',
        },
        res.locals.currentUser,
        validation,
        imageValidation.errors,
      );
    }

    const result = activityService.updateActivity(
      activityId,
      validation.input,
      res.locals.currentUser,
    );

    if (result.notFound) {
      deleteUploadedActivityImage(req.file);
      return next();
    }

    if (!result.ok) {
      deleteUploadedActivityImage(req.file);

      return renderFormWithErrors(
        res,
        422,
        {
          title: 'Editar actividad',
          formAction: `/admin/activities/${activityId}`,
          formTitle: 'Editar actividad',
          submitLabel: 'Guardar cambios',
        },
        res.locals.currentUser,
        validation,
        result.errors,
      );
    }

    return res.redirect('/admin/activities?message=Actividad%20actualizada');
  } catch (error) {
    return next(error);
  }
}

function deactivateActivity(req, res, next) {
  const result = activityService.deactivateActivity(
    Number(req.params.id),
    res.locals.currentUser,
  );

  if (result.notFound) {
    return next();
  }

  return res.redirect('/admin/activities?message=Actividad%20desactivada');
}

module.exports = {
  createActivity,
  deactivateActivity,
  showActivities,
  showEditActivity,
  showNewActivity,
  updateActivity,
};
