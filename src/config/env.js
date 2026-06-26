require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'change_me',
  databasePath: process.env.DATABASE_PATH || './src/database/catequesis.sqlite',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@sanpedro.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  loginVideoUrl: process.env.LOGIN_VIDEO_URL || '',
  loginPosterUrl: process.env.LOGIN_POSTER_URL || '',
  splashEnabled: process.env.SPLASH_ENABLED !== 'false',
  splashMinDelayMs: Number(process.env.SPLASH_MIN_DELAY_MS) || 900,
  splashMaxDelayMs: Number(process.env.SPLASH_MAX_DELAY_MS) || 2500,
  dashboardCardImageUrl: process.env.DASHBOARD_CARD_IMAGE_URL || '',
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || 'Catequesis San Pedro <no-reply@sanpedro.local>',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinarySecure: process.env.CLOUDINARY_SECURE !== 'false',
  cloudinaryRootFolder: process.env.CLOUDINARY_ROOT_FOLDER || 'san-pedro',
  ghostscriptPath: process.env.GHOSTSCRIPT_PATH || '',
  isDefaultAdminEmail: !process.env.ADMIN_EMAIL,
  isDefaultAdminPassword: !process.env.ADMIN_PASSWORD,
};

module.exports = env;
