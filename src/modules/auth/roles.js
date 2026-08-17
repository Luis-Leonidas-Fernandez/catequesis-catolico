const ROLES = {
  ADMIN: 'admin',
  COORDINADOR_ZONAL: 'coordinador_zonal',
  COORDINADOR_PARROQUIAL: 'coordinador_parroquial',
  CATEQUISTA: 'catequista',
  NINO: 'nino',
};

const USER_ROLES = [
  ROLES.ADMIN,
  ROLES.COORDINADOR_ZONAL,
  ROLES.COORDINADOR_PARROQUIAL,
  ROLES.CATEQUISTA,
];

const MANAGEABLE_USER_ROLES = USER_ROLES;

module.exports = {
  ROLES,
  MANAGEABLE_USER_ROLES,
  USER_ROLES,
};
