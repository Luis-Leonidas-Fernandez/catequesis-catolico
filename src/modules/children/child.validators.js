function normalizeChildInput(body) {
  return {
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    avatarPath: String(body.avatarPath || '').trim() || null,
    groupId: Number(body.groupId),
  };
}

function validateChild(body) {
  const input = normalizeChildInput(body);
  const errors = {};

  if (!input.firstName) {
    errors.firstName = 'El nombre es obligatorio.';
  }

  if (!input.lastName) {
    errors.lastName = 'El apellido es obligatorio.';
  }

  if (input.avatarPath && !/^https?:\/\/.+|^\/.+/.test(input.avatarPath)) {
    errors.avatarPath = 'El avatar debe ser una URL http(s) o una ruta que empiece con /.';
  }

  if (!Number.isInteger(input.groupId) || input.groupId <= 0) {
    errors.groupId = 'El grupo es obligatorio.';
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

module.exports = {
  validateChild,
};
