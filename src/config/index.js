require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-fallback-secret-minimum-32-characters-required',
  jwtExpiry: '15m',
  dbFile: process.env.DB_FILE || 'tripmate.db',
  cookieSecret: process.env.COOKIE_SECRET || 'dev-cookie-secret-min-32-chars-long',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',
  isProduction: process.env.NODE_ENV === 'production',
  bcryptRounds: 12,
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 10 // max 10 failed login/register attempts per 15 min
  }
};

const crypto = require('crypto');

if (config.isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn('WARNING: JWT_SECRET was not provided or was < 32 characters in production. Generating secure random 64-character ephemeral key for this session.');
  config.jwtSecret = crypto.randomBytes(32).toString('hex');
}

if (!config.cookieSecret || config.cookieSecret.length < 32) {
  config.cookieSecret = crypto.randomBytes(32).toString('hex');
}

module.exports = config;
