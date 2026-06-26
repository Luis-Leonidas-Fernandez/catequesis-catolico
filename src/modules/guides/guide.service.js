const guideRepository = require('./guide.repository');
const { resolveStoredGuidePath } = require('./guide-upload');
const mediaService = require('../media/media.service');
const childRepository = require('../children/child.repository');
const { ROLES } = require('../auth/roles');

function isCoordinator(user) {
  return user.role === ROLES.COORDINADOR_ZONAL || user.role === ROLES.COORDINADOR_PARROQUIAL;
}

function isCatechist(user) {
  return user.role === ROLES.CATEQUISTA_FAMILIAR || user.role === ROLES.CATEQUISTA_JUVENIL;
}

function canUploadGuide(user) {
  return [
    ROLES.ADMIN,
    ROLES.COORDINADOR_ZONAL,
    ROLES.COORDINADOR_PARROQUIAL,
    ROLES.CATEQUISTA_FAMILIAR,
    ROLES.CATEQUISTA_JUVENIL,
  ].includes(user.role);
}

function canDownloadGuide(user) {
  return Boolean(user);
}

function canDeleteGuide(user, guide) {
  if (!user || !guide) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  return canUploadGuide(user) && Number(user.parishId) === Number(guide.parish_id);
}

function getGuideParishId(input, actor) {
  if (actor.role === ROLES.ADMIN) {
    return Number(input.parishId || actor.parishId);
  }

  return Number(actor.parishId);
}

function canAccessGuide(user, guide) {
  if (!user || !guide) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  return Number(user.parishId) === Number(guide.parish_id);
}

function getAllowedCatechesisLevels(user) {
  const levels = guideRepository.listActiveCatechesisLevels();

  if (!user) {
    return levels;
  }

  if (user.role === ROLES.CATEQUISTA_FAMILIAR) {
    return levels.filter((level) => level.name === 'catequesis_familiar');
  }

  if (user.role === ROLES.CATEQUISTA_JUVENIL) {
    return levels.filter((level) => level.name === 'catequesis_juvenil');
  }

  return levels;
}

function getAllowedParishes(user) {
  const parishes = guideRepository.listActiveParishes();

  if (!user || user.role === ROLES.ADMIN) {
    return parishes;
  }

  return parishes.filter((parish) => parish.id === Number(user.parishId));
}

function getGuideFormOptions(user) {
  return {
    catechesisLevels: getAllowedCatechesisLevels(user),
    parishes: getAllowedParishes(user),
  };
}

function listGuides(user) {
  const filters = user && user.role !== ROLES.ADMIN
    ? { parishId: Number(user.parishId) || 0 }
    : {};

  return guideRepository.listGuides(filters);
}


function getActiveChildProfile(childId) {
  const child = childRepository.getChildProfile(childId);

  if (!child || !child.is_active) {
    return null;
  }

  return child;
}

function listGuidesForChild(childId) {
  const child = getActiveChildProfile(childId);

  if (!child) {
    return null;
  }

  return {
    profile: child,
    guides: guideRepository.listGuides({
      parishId: Number(child.parish_id),
      catechesisLevelId: Number(child.catechesis_level_id),
      onlyActive: true,
    }),
  };
}

function canChildAccessGuide(child, guide) {
  if (!child || !guide || !guide.is_active) {
    return false;
  }

  return Number(child.parish_id) === Number(guide.parish_id)
    && Number(child.catechesis_level_id) === Number(guide.catechesis_level_id);
}

function getGuideDownloadForChild(id, childId) {
  const child = getActiveChildProfile(childId);
  const guide = guideRepository.findGuideById(id);

  if (!canChildAccessGuide(child, guide)) {
    return null;
  }

  const filePath = resolveStoredGuidePath(guide.file_path);
  const mediaAsset = guide.media_asset_id
    ? mediaService.findMediaAssetById(guide.media_asset_id)
    : null;

  if (!filePath && !mediaAsset) {
    return null;
  }

  return {
    child,
    guide,
    filePath,
    mediaAsset,
  };
}

function validateGuideInput(body, filePath) {
  const input = {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim() || null,
    catechesisLevelId: Number(body.catechesisLevelId),
    parishId: Number(body.parishId),
    year: Number(body.year),
    filePath,
    mediaAssetId: Number(body.mediaAssetId) || null,
  };
  const errors = {};

  if (!input.title) {
    errors.title = 'El título es obligatorio.';
  }

  if (!Number.isInteger(input.catechesisLevelId) || input.catechesisLevelId <= 0) {
    errors.catechesisLevelId = 'El nivel de catequesis es obligatorio.';
  }

  if (!Number.isInteger(input.parishId) || input.parishId <= 0) {
    errors.parishId = 'La parroquia es obligatoria.';
  }

  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    errors.year = 'El año debe ser válido, por ejemplo 2026.';
  }

  if (!input.filePath) {
    errors.guideZip = 'Tenés que subir un PDF válido.';
  }

  return {
    input,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function createGuide(input, actor) {
  if (!canUploadGuide(actor)) {
    return {
      ok: false,
      errors: {
        guideZip: 'No tenés permiso para subir guías.',
      },
    };
  }

  const levels = getAllowedCatechesisLevels(actor);
  input.parishId = getGuideParishId(input, actor);

  const parishes = getAllowedParishes(actor);

  if (!parishes.some((parish) => parish.id === input.parishId)) {
    return {
      ok: false,
      errors: {
        parishId: 'No tenés permiso para subir guías en esa parroquia.',
      },
    };
  }

  if (!levels.some((level) => level.id === input.catechesisLevelId)) {
    return {
      ok: false,
      errors: {
        catechesisLevelId: 'El nivel de catequesis no existe, no está activo o no pertenece a tu rol.',
      },
    };
  }

  const guideId = guideRepository.runInTransaction(() => {
    const createdGuideId = guideRepository.createGuide({
      ...input,
      createdBy: actor.id,
    });
    if (input.mediaAssetId) {
      mediaService.updateMediaAssetOwner(input.mediaAssetId, 'guides', createdGuideId);
    }

    guideRepository.createAuditLog({
      userId: actor.id,
      action: 'guide_uploaded',
      entityType: 'guides',
      entityId: createdGuideId,
      metadata: {
        catechesisLevelId: input.catechesisLevelId,
        parishId: input.parishId,
        year: input.year,
      },
    });

    return createdGuideId;
  });

  return {
    ok: true,
    guideId,
  };
}

function getGuideDownload(id, actor) {
  if (!canDownloadGuide(actor)) {
    return null;
  }

  const guide = guideRepository.findGuideById(id);

  if (!guide || !guide.is_active || !canAccessGuide(actor, guide)) {
    return null;
  }

  const filePath = resolveStoredGuidePath(guide.file_path);

  const mediaAsset = guide.media_asset_id
    ? mediaService.findMediaAssetById(guide.media_asset_id)
    : null;

  if (!filePath && !mediaAsset) {
    return null;
  }

  return {
    guide,
    filePath,
    mediaAsset,
  };
}


function deleteGuide(id, actor) {
  const guide = guideRepository.findGuideById(id);

  if (!canDeleteGuide(actor, guide)) {
    return {
      ok: false,
      notFound: true,
    };
  }

  const filePath = guide.file_path;
  const mediaAsset = guide.media_asset_id
    ? mediaService.findMediaAssetById(guide.media_asset_id)
    : null;

  guideRepository.runInTransaction(() => {
    guideRepository.softDeleteGuide(id);

    guideRepository.createAuditLog({
      userId: actor.id,
      action: 'guide_deleted',
      entityType: 'guides',
      entityId: id,
      metadata: {
        parishId: guide.parish_id,
        catechesisLevelId: guide.catechesis_level_id,
        year: guide.year,
      },
    });
  });

  return {
    ok: true,
    filePath,
    mediaAsset,
  };
}

module.exports = {
  canUploadGuide,
  createGuide,
  deleteGuide,
  getGuideDownload,
  getGuideDownloadForChild,
  getGuideFormOptions,
  listGuides,
  listGuidesForChild,
  validateGuideInput,
};
