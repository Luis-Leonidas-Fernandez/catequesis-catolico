const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const multer = require('multer');

const MAX_GUIDE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const TEMP_DIRECTORY = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp', 'guides');
const PRIVATE_GUIDES_DIRECTORY = path.join(__dirname, '..', '..', '..', 'uploads', 'private', 'guides');
const ALLOWED_ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed']);
const ALLOWED_PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf']);

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function safeUnlink(filePath) {
  if (!filePath) {
    return;
  }

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    ensureDirectory(TEMP_DIRECTORY);
    callback(null, TEMP_DIRECTORY);
  },
  filename(req, file, callback) {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension || '.upload'}`);
  },
});

function fileFilter(req, file, callback) {
  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  const isPdf = extension === '.pdf' && ALLOWED_PDF_MIME_TYPES.has(file.mimetype);
  const isZip = extension === '.zip' && ALLOWED_ZIP_MIME_TYPES.has(file.mimetype);

  if (!isPdf && !isZip) {
    req.uploadError = 'La guía debe subirse como PDF válido. También se acepta ZIP con un único PDF.';
    return callback(null, false);
  }

  return callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_GUIDE_FILE_SIZE_BYTES,
    files: 1,
  },
});

function uploadGuideFile(req, res, next) {
  return upload.single('guideFile')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      req.uploadError = 'El archivo no puede superar los 20 MB.';
      return next();
    }

    if (error) {
      req.uploadError = 'No se pudo procesar el archivo. Subí un PDF válido o un ZIP con un único PDF.';
      return next();
    }

    return next();
  });
}

const uploadGuideZip = uploadGuideFile;

function isDangerousEntryName(entryName) {
  const normalized = String(entryName || '').replace(/\\/g, '/');

  return (
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  );
}

function isPdfBuffer(buffer) {
  return buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
}

function storePdfBuffer(pdfBuffer, originalName = '') {
  if (!isPdfBuffer(pdfBuffer)) {
    return {
      ok: false,
      error: 'El PDF no es válido.',
    };
  }

  ensureDirectory(PRIVATE_GUIDES_DIRECTORY);

  const pdfFileName = `${crypto.randomUUID()}.pdf`;
  const pdfPath = path.join(PRIVATE_GUIDES_DIRECTORY, pdfFileName);
  fs.writeFileSync(pdfPath, pdfBuffer, { mode: 0o600 });

  return {
    ok: true,
    storedPath: path.join('uploads', 'private', 'guides', pdfFileName),
    originalFilename: originalName || 'guia.pdf',
  };
}

function storeDirectPdf(pdfFile) {
  const pdfBuffer = fs.readFileSync(pdfFile.path);
  const result = storePdfBuffer(pdfBuffer, pdfFile.originalname);
  safeUnlink(pdfFile.path);
  return result;
}

function extractSinglePdfFromZip(zipFile) {
  if (!zipFile) {
    return {
      ok: false,
      error: 'Tenés que seleccionar un archivo ZIP.',
    };
  }

  let zip;

  try {
    zip = new AdmZip(zipFile.path);
  } catch (error) {
    safeUnlink(zipFile.path);
    return {
      ok: false,
      error: 'El archivo ZIP no se pudo abrir.',
    };
  }

  const fileEntries = zip.getEntries().filter((entry) => !entry.isDirectory);

  if (fileEntries.some((entry) => isDangerousEntryName(entry.entryName))) {
    safeUnlink(zipFile.path);
    return {
      ok: false,
      error: 'El ZIP contiene una ruta peligrosa.',
    };
  }

  const pdfEntries = fileEntries.filter((entry) => path.extname(entry.entryName).toLowerCase() === '.pdf');

  if (fileEntries.length !== 1 || pdfEntries.length !== 1) {
    safeUnlink(zipFile.path);
    return {
      ok: false,
      error: 'El ZIP debe contener un único PDF.',
    };
  }

  const result = storePdfBuffer(pdfEntries[0].getData(), pdfEntries[0].entryName);
  safeUnlink(zipFile.path);

  if (!result.ok) {
    return {
      ok: false,
      error: 'El PDF dentro del ZIP no es válido.',
    };
  }

  return result;
}

function extractGuidePdf(uploadedFile) {
  if (!uploadedFile) {
    return {
      ok: false,
      error: 'Tenés que seleccionar un PDF.',
    };
  }

  const extension = path.extname(String(uploadedFile.originalname || uploadedFile.path || '')).toLowerCase();

  if (extension === '.pdf') {
    return storeDirectPdf(uploadedFile);
  }

  if (extension === '.zip') {
    return extractSinglePdfFromZip(uploadedFile);
  }

  safeUnlink(uploadedFile.path);

  return {
    ok: false,
    error: 'La guía debe ser un PDF válido.',
  };
}

function deleteStoredGuidePdf(storedPath) {
  if (!storedPath) {
    return;
  }

  const absolutePath = path.resolve(path.join(__dirname, '..', '..', '..'), storedPath);
  const guidesRoot = path.resolve(PRIVATE_GUIDES_DIRECTORY);

  if (!absolutePath.startsWith(guidesRoot + path.sep)) {
    return;
  }

  safeUnlink(absolutePath);
}

function resolveStoredGuidePath(storedPath) {
  const absolutePath = path.resolve(path.join(__dirname, '..', '..', '..'), storedPath);
  const guidesRoot = path.resolve(PRIVATE_GUIDES_DIRECTORY);

  if (!absolutePath.startsWith(guidesRoot + path.sep)) {
    return null;
  }

  return absolutePath;
}

module.exports = {
  deleteStoredGuidePdf,
  extractGuidePdf,
  extractSinglePdfFromZip,
  resolveStoredGuidePath,
  uploadGuideFile,
  uploadGuideZip,
};
