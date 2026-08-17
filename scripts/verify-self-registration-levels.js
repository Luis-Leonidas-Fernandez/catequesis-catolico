const assert = require('assert');
const { db } = require('../src/config/database');
const { validateSelfRegisterCatechist } = require('../src/modules/users/user.validators');
const userService = require('../src/modules/users/user.service');
const catechistLevelService = require('../src/modules/catechist-levels/catechist-level.service');

const REQUIRED_LEVEL_NAMES = [
  'catequesis_familiar',
  'catequesis_juvenil',
  'catequesis_bautismal',
];

function validBody(levelIds) {
  return {
    name: 'Catequista de prueba',
    email: 'catequista.prueba@example.com',
    role: 'catequista',
    parishId: '',
    password: 'password-segura',
    catechesisLevelIds: levelIds,
  };
}

function validServiceInput(levelIds, overrides = {}) {
  return {
    ...validBody(levelIds),
    hasCatechesisLevelSelection: true,
    hasInvalidCatechesisLevelIds: false,
    ...overrides,
  };
}

async function verify() {
  const levels = catechistLevelService.listSelfRegistrationLevels();
  assert.deepStrictEqual(
    levels.map((level) => level.name),
    REQUIRED_LEVEL_NAMES,
    'Los niveles habilitados para el auto-registro no coinciden con los permitidos.',
  );

  const validLevelId = levels[0].id;
  assert.strictEqual(validateSelfRegisterCatechist(validBody([])).isValid, false, 'Debe rechazar un registro sin niveles.');
  assert.strictEqual(validateSelfRegisterCatechist(validBody([validLevelId, validLevelId])).isValid, false, 'Debe rechazar niveles duplicados.');
  assert.strictEqual(validateSelfRegisterCatechist(validBody([validLevelId, 'invalido'])).isValid, false, 'Debe rechazar IDs de nivel inválidos.');
  assert.strictEqual(validateSelfRegisterCatechist(validBody([validLevelId, true])).isValid, false, 'Debe rechazar IDs de nivel no numéricos.');
  assert.strictEqual(catechistLevelService.validateSelfRegistrationLevelIds([validLevelId]), true, 'Debe aceptar un nivel activo permitido.');
  assert.strictEqual(catechistLevelService.validateSelfRegistrationLevelIds([validLevelId, validLevelId]), false, 'El servicio debe rechazar niveles duplicados.');
  assert.strictEqual(catechistLevelService.validateSelfRegistrationLevelIds([999999]), false, 'El servicio debe rechazar IDs desconocidos.');

  const missingResult = await userService.createSelfRegisteredCatechist(
    validServiceInput([], { hasCatechesisLevelSelection: false }),
  );
  assert.strictEqual(missingResult.ok, false, 'El backend debe rechazar un auto-registro sin niveles.');

  const duplicateResult = await userService.createSelfRegisteredCatechist(
    validServiceInput([validLevelId, validLevelId]),
  );
  assert.strictEqual(duplicateResult.ok, false, 'El backend debe rechazar niveles duplicados.');

  const invalidResult = await userService.createSelfRegisteredCatechist(
    validServiceInput(['invalido'], { hasInvalidCatechesisLevelIds: true }),
  );
  assert.strictEqual(invalidResult.ok, false, 'El backend debe rechazar IDs de nivel inválidos.');

  let inactiveRegistration;
  const deactivateAndRollback = db.transaction(() => {
    db.prepare('UPDATE catechesis_levels SET is_active = 0 WHERE id = ?').run(validLevelId);
    assert.strictEqual(catechistLevelService.validateSelfRegistrationLevelIds([validLevelId]), false, 'El servicio debe rechazar niveles inactivos.');
    inactiveRegistration = userService.createSelfRegisteredCatechist(validServiceInput([validLevelId]));
    throw new Error('rollback verification');
  });

  try {
    deactivateAndRollback();
  } catch (error) {
    if (error.message !== 'rollback verification') {
      throw error;
    }
  }

  const inactiveResult = await inactiveRegistration;
  assert.strictEqual(inactiveResult.ok, false, 'El backend debe rechazar niveles inactivos.');

  console.log('Self-registration catechesis-level verification passed.');
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
