function normalizeGroupInput(body) {
  return {
    parishId: Number(body.parishId),
    catechesisLevelId: Number(body.catechesisLevelId),
    catechistId: body.catechistId ? Number(body.catechistId) : null,
    name: String(body.name || '').trim(),
    year: Number(body.year),
  };
}

function validateGroup(body) {
  const input = normalizeGroupInput(body);
  const errors = {};
  const currentYear = new Date().getFullYear();

  if (!input.name) {
    errors.name = 'El nombre del grupo es obligatorio.';
  }

  if (!Number.isInteger(input.parishId) || input.parishId <= 0) {
    errors.parishId = 'La parroquia es obligatoria.';
  }

  if (!Number.isInteger(input.catechesisLevelId) || input.catechesisLevelId <= 0) {
    errors.catechesisLevelId = 'El nivel de catequesis es obligatorio.';
  }

  if (input.catechistId !== null && (!Number.isInteger(input.catechistId) || input.catechistId <= 0)) {
    errors.catechistId = 'El catequista seleccionado no es válido.';
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > currentYear + 5) {
    errors.year = 'El año no es válido.';
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

module.exports = {
  validateGroup,
};
