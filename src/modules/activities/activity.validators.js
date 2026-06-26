const { ACTIVITY_TYPES } = require('./activity.constants');

function normalizeActivityInput(body) {
  const questions = [];
  const prompts = Array.isArray(body.questionPrompt)
    ? body.questionPrompt
    : [body.questionPrompt];

  for (let index = 0; index < prompts.length; index += 1) {
    const prompt = String(prompts[index] || '').trim();

    if (!prompt) {
      continue;
    }

    const answerTexts = [1, 2, 3, 4].map((answerNumber) =>
      String(body[`question${index}Answer${answerNumber}`] || '').trim(),
    );
    const correctIndex = Number(body[`question${index}CorrectAnswer`]);
    const answers = answerTexts
      .map((text, answerIndex) => ({
        text,
        isCorrect: answerIndex + 1 === correctIndex,
        displayOrder: answerIndex,
      }))
      .filter((answer) => answer.text);

    questions.push({
      prompt,
      displayOrder: index,
      answers,
    });
  }

  return {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim() || null,
    activityType: String(body.activityType || '').trim(),
    catechesisLevelId: Number(body.catechesisLevelId),
    points: Number(body.points),
    imagePath: String(body.imagePath || '').trim() || null,
    mediaAssetId: Number(body.mediaAssetId) || null,
    questions,
  };
}

function validateActivity(body) {
  const input = normalizeActivityInput(body);
  const errors = {};

  if (!input.title) {
    errors.title = 'El título es obligatorio.';
  }

  if (!ACTIVITY_TYPES.includes(input.activityType)) {
    errors.activityType = 'El tipo de actividad no es válido.';
  }

  if (!Number.isInteger(input.catechesisLevelId) || input.catechesisLevelId <= 0) {
    errors.catechesisLevelId = 'El nivel de catequesis es obligatorio.';
  }

  if (!Number.isInteger(input.points) || input.points < 0 || input.points > 1000) {
    errors.points = 'Los puntos deben ser un número entre 0 y 1000.';
  }

  if (
    input.imagePath &&
    !/^\/uploads\/images\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(input.imagePath) &&
    !/^https:\/\/res\.cloudinary\.com\/.+/i.test(input.imagePath)
  ) {
    errors.imagePath = 'La imagen debe ser una ruta generada por el sistema de subida.';
  }

  if (input.questions.length === 0) {
    errors.questions = 'La actividad debe tener al menos una pregunta.';
  }

  input.questions.forEach((question, index) => {
    if (question.answers.length < 2) {
      errors[`question${index}`] = 'Cada pregunta debe tener al menos dos respuestas.';
    }

    if (!question.answers.some((answer) => answer.isCorrect)) {
      errors[`question${index}CorrectAnswer`] = 'Cada pregunta debe tener al menos una respuesta correcta.';
    }
  });

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

module.exports = {
  validateActivity,
};
