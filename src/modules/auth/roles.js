const ROLES = {
  ADMIN: 'admin',
  COORDINADOR_ZONAL: 'coordinador_zonal',
  COORDINADOR_PARROQUIAL: 'coordinador_parroquial',
  CATEQUISTA_FAMILIAR: 'catequista_familiar',
  CATEQUISTA_JUVENIL: 'catequista_juvenil',
};

const ADMINISTRATIVE_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  ADMINISTRATIVE_ROLES,
};
