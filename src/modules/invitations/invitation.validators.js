const { ROLES } = require('../auth/roles');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const COORDINATOR_ROLES = [ROLES.COORDINADOR_PARROQUIAL, ROLES.COORDINADOR_ZONAL];

function validateCreateInvitation(body) {
  const input = {
    email: String(body.email || '').trim().toLowerCase(),
    role: String(body.role || '').trim(),
    expiresInHours: Number(body.expiresInHours || 72),
  };
  const errors = {};

  if (!input.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!EMAIL_PATTERN.test(input.email)) {
    errors.email = 'El email no tiene un formato válido.';
  }

  if (!COORDINATOR_ROLES.includes(input.role)) {
    errors.role = 'Solo podés invitar coordinadores parroquiales o zonales.';
  }

  if (!Number.isInteger(input.expiresInHours) || input.expiresInHours < 1 || input.expiresInHours > 720) {
    errors.expiresInHours = 'El vencimiento debe estar entre 1 y 720 horas.';
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function validateCoordinatorRegistration(body) {
  const input = {
    name: String(body.name || '').trim(),
    parishName: String(body.parishName || '').trim(),
    password: String(body.password || ''),
  };
  const errors = {};

  if (!input.name) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (!input.parishName) {
    errors.parishName = 'El nombre de la parroquia es obligatorio.';
  } else if (input.parishName.length < 3) {
    errors.parishName = 'La parroquia debe tener al menos 3 caracteres.';
  }

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

module.exports = {
  COORDINATOR_ROLES,
  validateCoordinatorRegistration,
  validateCreateInvitation,
};
