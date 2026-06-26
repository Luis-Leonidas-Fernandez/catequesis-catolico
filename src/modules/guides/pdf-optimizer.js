const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../../config/env');

const DEFAULT_PDF_SETTINGS = '/ebook';
const GHOSTSCRIPT_CANDIDATES = [
  env.ghostscriptPath,
  '/opt/homebrew/bin/gs',
  '/usr/local/bin/gs',
  '/usr/bin/gs',
  'gs',
].filter(Boolean);

class PdfOptimizationError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'PdfOptimizationError';
    this.cause = cause;
  }
}

function isPdfFile(filePath) {
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(5);

  try {
    fs.readSync(handle, buffer, 0, buffer.length, 0);
    return buffer.toString('ascii') === '%PDF-';
  } finally {
    fs.closeSync(handle);
  }
}

function resolveGhostscriptCommand() {
  for (const candidate of GHOSTSCRIPT_CANDIDATES) {
    if (candidate === 'gs') {
      return candidate;
    }

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'gs';
}

function runGhostscript(inputPath, outputPath) {
  const command = resolveGhostscriptCommand();
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.6',
    `-dPDFSETTINGS=${DEFAULT_PDF_SETTINGS}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dSAFER',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dAutoRotatePages=/None',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        const isMissing = error.code === 'ENOENT';
        const message = isMissing
          ? 'Ghostscript no está instalado o no está disponible en el PATH.'
          : 'Ghostscript no pudo optimizar el PDF.';

        reject(new PdfOptimizationError(message, {
          code: error.code,
          signal: error.signal,
          stderr: String(stderr || '').slice(0, 1000),
          stdout: String(stdout || '').slice(0, 1000),
        }));
        return;
      }

      resolve();
    });
  });
}

async function optimizePdfInPlace(inputPath) {
  if (!inputPath || path.extname(inputPath).toLowerCase() !== '.pdf') {
    throw new PdfOptimizationError('El archivo a optimizar debe ser un PDF.');
  }

  if (!fs.existsSync(inputPath)) {
    throw new PdfOptimizationError('No se encontró el PDF para optimizar.');
  }

  if (!isPdfFile(inputPath)) {
    throw new PdfOptimizationError('El archivo extraído no parece ser un PDF válido.');
  }

  const inputStats = fs.statSync(inputPath);
  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, '.pdf')}.optimized-${crypto.randomUUID()}.pdf`,
  );

  try {
    await runGhostscript(inputPath, outputPath);

    if (!fs.existsSync(outputPath) || !isPdfFile(outputPath)) {
      throw new PdfOptimizationError('Ghostscript generó un PDF inválido.');
    }

    const outputStats = fs.statSync(outputPath);
    const shouldReplace = outputStats.size > 0 && outputStats.size <= inputStats.size;

    if (shouldReplace) {
      fs.renameSync(outputPath, inputPath);
    } else {
      fs.unlinkSync(outputPath);
    }

    const finalStats = fs.statSync(inputPath);

    return {
      optimized: shouldReplace,
      originalBytes: inputStats.size,
      finalBytes: finalStats.size,
      savedBytes: Math.max(0, inputStats.size - finalStats.size),
    };
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    if (error instanceof PdfOptimizationError) {
      throw error;
    }

    throw new PdfOptimizationError('No se pudo optimizar el PDF.', error);
  }
}

module.exports = {
  PdfOptimizationError,
  optimizePdfInPlace,
};
