const logger = require('../config/logger');
const { createAuditLog } = require('../utils/audit-log');

function notFoundMiddleware(req, res, next) {
  const error = new Error('Página no encontrada');
  error.status = 404;
  next(error);
}

function errorMiddleware(error, req, res, next) {
  if (error.code === 'EBADCSRFTOKEN') {
    logger.warn({
      event: 'csrf_error',
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    }, 'Invalid CSRF token');

    return res.status(403).render('csrf-error', {
      title: 'Solicitud inválida',
    });
  }

  const status = error.status || 500;

  if (status >= 500) {
    logger.error({
      event: 'request_error',
      method: req.method,
      path: req.originalUrl,
      status,
      ip: req.ip,
      err: error,
    }, 'Unhandled request error');

    createAuditLog({
      userId: req.session ? req.session.userId : null,
      action: 'error_general',
      entityType: 'system',
      metadata: {
        method: req.method,
        path: req.originalUrl,
        status,
        message: error.message || 'Error interno del servidor',
      },
    });

    return res.status(status).send('Error interno del servidor');
  }

  logger.warn({
    event: 'request_warning',
    method: req.method,
    path: req.originalUrl,
    status,
    ip: req.ip,
    message: error.message,
  }, 'Request warning');

  return res.status(status).send(error.message || 'Error interno del servidor');
}

module.exports = {
  notFoundMiddleware,
  errorMiddleware,
};
