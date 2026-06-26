const guideService = require('./guide.service');
const {
  deleteStoredGuidePdf,
  extractGuidePdf,
  resolveStoredGuidePath,
} = require('./guide-upload');
const { optimizePdfInPlace, PdfOptimizationError } = require('./pdf-optimizer');
const mediaService = require('../media/media.service');
const logger = require('../../config/logger');
const { createAuditLog } = require('../../utils/audit-log');
const escapeHtml = require('../../utils/escape-html');

function renderGuideForm(res, status, currentUser, overrides = {}) {
  return res.status(status).render('guides/index', {
    title: 'Guías anuales',
    user: currentUser,
    guides: guideService.listGuides(currentUser),
    csrfToken: res.locals.csrfToken,
    errors: {},
    guide: {
      title: '',
      description: '',
      catechesisLevelId: '',
      parishId: currentUser.parishId || '',
      year: new Date().getFullYear(),
    },
    message: '',
    ...guideService.getGuideFormOptions(currentUser),
    ...overrides,
    escapeHtml,
  });
}

function showGuides(req, res) {
  return renderGuideForm(res, 200, res.locals.currentUser, {
    message: req.query.message || '',
  });
}

async function createGuide(req, res, next) {
  let extractedGuidePath = null;

  try {
    if (req.uploadError) {
      logger.warn({
        event: 'guide_file_rejected',
        userId: res.locals.currentUser.id,
        reason: req.uploadError,
      }, 'Guide file rejected');

      createAuditLog({
        userId: res.locals.currentUser.id,
        action: 'guide_file_rejected',
        entityType: 'guides',
        metadata: {
          reason: req.uploadError,
        },
      });

      return renderGuideForm(res, 422, res.locals.currentUser, {
        errors: {
          guideZip: req.uploadError,
        },
        guide: {
          title: req.body.title || '',
          description: req.body.description || '',
          catechesisLevelId: req.body.catechesisLevelId || '',
          parishId: req.body.parishId || res.locals.currentUser.parishId || '',
          year: req.body.year || new Date().getFullYear(),
        },
      });
    }

    const extraction = extractGuidePdf(req.file);
    extractedGuidePath = extraction.ok ? extraction.storedPath : null;
    const guideInput = {
      ...req.body,
      parishId: req.body.parishId || res.locals.currentUser.parishId,
    };
    const validation = guideService.validateGuideInput(
      guideInput,
      extractedGuidePath,
    );

    if (!extraction.ok || !validation.isValid) {
      if (!extraction.ok) {
        logger.warn({
          event: 'guide_file_rejected',
          userId: res.locals.currentUser.id,
          reason: extraction.error,
        }, 'Guide file rejected');

        createAuditLog({
          userId: res.locals.currentUser.id,
          action: 'guide_file_rejected',
          entityType: 'guides',
          metadata: {
            reason: extraction.error,
          },
        });
      }

      if (extraction.ok) {
        deleteStoredGuidePdf(extractedGuidePath);
        extractedGuidePath = null;
      }

      return renderGuideForm(res, 422, res.locals.currentUser, {
        errors: {
          ...validation.errors,
          ...(!extraction.ok ? { guideZip: extraction.error } : {}),
        },
        guide: {
          title: validation.input.title,
          description: validation.input.description || '',
          catechesisLevelId: validation.input.catechesisLevelId || '',
          parishId: validation.input.parishId || '',
          year: validation.input.year || req.body.year || new Date().getFullYear(),
        },
      });
    }

    try {
      await optimizePdfInPlace(resolveStoredGuidePath(extractedGuidePath));
    } catch (error) {
      logger.warn({
        event: 'guide_pdf_optimization_failed',
        error: error.message,
      }, 'Guide PDF optimization failed');

      deleteStoredGuidePdf(extractedGuidePath);
      extractedGuidePath = null;

      return renderGuideForm(res, 422, res.locals.currentUser, {
        errors: {
          guideZip: error instanceof PdfOptimizationError
            ? error.message
            : 'No se pudo optimizar el PDF antes de subirlo.',
        },
        guide: {
          ...guideInput,
          parishId: validation.input.parishId,
        },
      });
    }

    const cloudUpload = await mediaService.uploadPrivateRaw(extractedGuidePath, {
      ownerType: 'guides',
      ownerId: null,
      parishId: validation.input.parishId,
      kind: 'guide_pdf',
      accessScope: 'parish',
      folder: mediaService.buildFolder(['guides', `parish-${validation.input.parishId}`, String(validation.input.year)]),
      mimeType: 'application/pdf',
      originalFilename: `${validation.input.title}.pdf`,
      createdBy: res.locals.currentUser.id,
    });
    validation.input.mediaAssetId = cloudUpload.mediaAssetId;

    const result = guideService.createGuide(validation.input, res.locals.currentUser);

    if (!result.ok) {
      deleteStoredGuidePdf(extractedGuidePath);
      extractedGuidePath = null;
      const mediaAsset = mediaService.findMediaAssetById(cloudUpload.mediaAssetId);
      await mediaService.deleteCloudinaryAsset(mediaAsset);

      return renderGuideForm(res, 422, res.locals.currentUser, {
        errors: result.errors,
        guide: {
          title: validation.input.title,
          description: validation.input.description || '',
          catechesisLevelId: validation.input.catechesisLevelId || '',
          parishId: validation.input.parishId || '',
          year: validation.input.year || req.body.year || new Date().getFullYear(),
        },
      });
    }

    deleteStoredGuidePdf(extractedGuidePath);
    extractedGuidePath = null;
    return res.redirect('/guides?message=Guía%20subida');
  } catch (error) {
    deleteStoredGuidePdf(extractedGuidePath);
    return next(error);
  }
}


async function deleteGuide(req, res, next) {
  try {
    const result = guideService.deleteGuide(Number(req.params.id), res.locals.currentUser);

    if (result.notFound) {
      return next();
    }

    if (result.ok) {
      deleteStoredGuidePdf(result.filePath);
      await mediaService.deleteCloudinaryAsset(result.mediaAsset);
    }

    return res.redirect('/guides?message=Guía%20eliminada');
  } catch (error) {
    return next(error);
  }
}

function downloadGuide(req, res, next) {
  const result = guideService.getGuideDownload(Number(req.params.id), res.locals.currentUser);

  if (!result) {
    return next();
  }

  if (result.mediaAsset) {
    return mediaService.streamPrivateAsset(result.mediaAsset, res, `${result.guide.title}.pdf`);
  }

  return res.download(result.filePath, `${result.guide.title}.pdf`);
}

module.exports = {
  createGuide,
  deleteGuide,
  downloadGuide,
  showGuides,
};
