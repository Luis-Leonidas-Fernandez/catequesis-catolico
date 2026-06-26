const express = require('express');
const session = require('express-session');
const path = require('path');
const env = require('./config/env');
const { testConnection } = require('./config/database');
const sessionConfig = require('./config/session');
const { loadRememberedChild } = require('./middlewares/child-remember.middleware');
const { loadCurrentUser } = require('./middlewares/auth.middleware');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');
const {
  accessLimiter,
  childAccessLimiter,
  loginLimiter,
  uploadLimiter,
} = require('./middlewares/rate-limit.middleware');
const {
  applyCsrfProtection,
  exposeCsrfToken,
  helmetMiddleware,
} = require('./middlewares/security.middleware');
const activityRoutes = require('./modules/activities/activity.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const authRoutes = require('./modules/auth/auth.routes');
const backupRoutes = require('./modules/backups/backup.routes');
const childRoutes = require('./modules/children/child.routes');
const coordinationRoutes = require('./modules/coordination/coordination.routes');
const guideRoutes = require('./modules/guides/guide.routes');
const groupRoutes = require('./modules/groups/group.routes');
const invitationRoutes = require('./modules/invitations/invitation.routes');
const progressRoutes = require('./modules/progress/progress.routes');
const reportRoutes = require('./modules/reports/report.routes');
const systemRoutes = require('./modules/system/system.routes');
const userRoutes = require('./modules/users/user.routes');

const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmetMiddleware);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads/images', express.static(path.join(__dirname, '..', 'uploads', 'public', 'images')));
app.use(session(sessionConfig));
app.use('/login', loginLimiter);
app.use('/registro-catequista', loginLimiter);
app.use('/registro-coordinador', loginLimiter);
app.use('/acceso-nino', childAccessLimiter);
app.use('/access', accessLimiter);
app.use('/upload', uploadLimiter);
app.use(loadRememberedChild);
app.use(applyCsrfProtection);
app.use(exposeCsrfToken);
app.use(loadCurrentUser);

app.use((req, res, next) => {
  const publicBackButtonPaths = new Set([
    '/',
    '/splash',
    '/login',
    '/registro-catequista',
    '/registro-coordinador',
    '/acceso-nino',
  ]);

  res.locals.currentPath = req.path;
  res.locals.showBackButton = !publicBackButtonPaths.has(req.path);

  if (req.session.childId) {
    res.locals.backFallbackUrl = '/perfil-nino';
  } else if (req.session.userId) {
    res.locals.backFallbackUrl = '/dashboard';
  } else {
    res.locals.backFallbackUrl = '/login';
  }

  return next();
});

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  if (req.session.childId) {
    return res.redirect('/perfil-nino');
  }

  return res.redirect(env.splashEnabled ? '/splash' : '/login');
});

app.get('/health/db', (req, res, next) => {
  try {
    const result = testConnection();

    res.json({
      status: 'ok',
      database: result,
    });
  } catch (error) {
    next(error);
  }
});

app.use(authRoutes);
app.use(activityRoutes);
app.use(adminRoutes);
app.use(backupRoutes);
app.use(childRoutes);
app.use(coordinationRoutes);
app.use(guideRoutes);
app.use(groupRoutes);
app.use(invitationRoutes);
app.use(progressRoutes);
app.use(reportRoutes);
app.use(systemRoutes);
app.use(userRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
