function normalizeChildInput(body) {
  return {
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    guardianName: String(body.guardianName || '').trim(),
    guardianRelationship: String(body.guardianRelationship || '').trim() || 'tutor',
    guardianPhone: String(body.guardianPhone || '').trim() || null,
    guardianEmail: String(body.guardianEmail || '').trim().toLowerCase() || null,
    godfatherName: String(body.godfatherName || '').trim() || null,
    godmotherName: String(body.godmotherName || '').trim() || null,
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

  if (!input.guardianName) {
    errors.guardianName = 'El nombre del padre, madre o tutor es obligatorio.';
  }

  if (input.guardianRelationship.length > 40) {
    errors.guardianRelationship = 'La relación no puede superar los 40 caracteres.';
  }

  if (input.guardianPhone && !/^[+()\d\s-]{7,25}$/.test(input.guardianPhone)) {
    errors.guardianPhone = 'Ingresá un teléfono válido.';
  }

  if (input.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.guardianEmail)) {
    errors.guardianEmail = 'Ingresá un email válido.';
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
