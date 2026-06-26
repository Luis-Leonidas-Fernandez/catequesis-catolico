const env = require('./env');

const sessionConfig = {
  name: 'catequesis.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 2,
  },
};

module.exports = sessionConfig;
