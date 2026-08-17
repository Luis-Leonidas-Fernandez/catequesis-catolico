const { MANAGEABLE_USER_ROLES, ROLES } = require('../auth/roles');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const SELF_REGISTRATION_ROLES = [ROLES.CATEQUISTA];

function normalizeUserInput(body) {
  const hasCatechesisLevelSelection = Object.prototype.hasOwnProperty.call(body, 'catechesisLevelIds');
  const submittedLevelIds = hasCatechesisLevelSelection
    ? (Array.isArray(body.catechesisLevelIds) ? body.catechesisLevelIds : [body.catechesisLevelIds])
    : [];
  const normalizedLevelIds = submittedLevelIds.map((levelId) => {
    if (typeof levelId === 'number') {
      return levelId;
    }

    return typeof levelId === 'string' && /^\d+$/.test(levelId.trim())
      ? Number(levelId)
      : NaN;
  });

  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    role: String(body.role || '').trim(),
    parishId: body.parishId ? Number(body.parishId) : null,
    password: String(body.password || ''),
    catechesisLevelIds: normalizedLevelIds.filter(Number.isInteger),
    hasCatechesisLevelSelection,
    hasInvalidCatechesisLevelIds: normalizedLevelIds.some((levelId) => !Number.isInteger(levelId)),
  };
}

function validateBaseUser(input) {
  const errors = {};

  if (!input.name) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (!input.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!EMAIL_PATTERN.test(input.email)) {
    errors.email = 'El email no tiene un formato válido.';
  }

  if (!MANAGEABLE_USER_ROLES.includes(input.role)) {
    errors.role = 'El rol seleccionado no es válido.';
  }

  if (input.parishId !== null && (!Number.isInteger(input.parishId) || input.parishId <= 0)) {
    errors.parishId = 'La parroquia seleccionada no es válida.';
  }

  return errors;
}

function validateCreateUser(body) {
  const input = normalizeUserInput(body);
  const errors = validateBaseUser(input);

  if (!input.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function validateSelfRegisterCatechist(body) {
  const input = normalizeUserInput(body);
  const errors = validateBaseUser(input);

  if (!SELF_REGISTRATION_ROLES.includes(input.role)) {
    errors.role = 'Solo podés registrarte como catequista.';
  }

  if (!input.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (!input.hasCatechesisLevelSelection || input.catechesisLevelIds.length === 0) {
    errors.catechesisLevelIds = 'Seleccioná al menos un nivel de catequesis.';
  } else if (
    input.hasInvalidCatechesisLevelIds
    || new Set(input.catechesisLevelIds).size !== input.catechesisLevelIds.length
  ) {
    errors.catechesisLevelIds = 'Los niveles seleccionados no son válidos.';
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function validateUpdateUser(body) {
  const input = normalizeUserInput(body);
  const errors = validateBaseUser(input);

  if (input.password && input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

module.exports = {
  SELF_REGISTRATION_ROLES,
  validateCreateUser,
  validateSelfRegisterCatechist,
  validateUpdateUser,
};
