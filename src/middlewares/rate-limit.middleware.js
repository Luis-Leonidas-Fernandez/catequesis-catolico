const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos de login. Probá nuevamente en unos minutos.',
});

const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes de acceso. Probá nuevamente en unos minutos.',
});

const childAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: (req) => req.method !== 'POST',
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos de acceso de niño. Esperá 15 minutos y probá nuevamente.',
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes de carga. Probá nuevamente más tarde.',
});

module.exports = {
  childAccessLimiter,
  loginLimiter,
  accessLimiter,
  uploadLimiter,
};
