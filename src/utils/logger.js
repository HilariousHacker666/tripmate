const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure log directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Redact sensitive keys
const sanitizeFormat = winston.format((info) => {
  const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'authorization', 'cookie'];
  const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key of Object.keys(cloned)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        cloned[key] = '[REDACTED]';
      } else if (typeof cloned[key] === 'object') {
        cloned[key] = redact(cloned[key]);
      }
    }
    return cloned;
  };
  return redact(info);
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'tripmate' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

// Always log to console in development and test
if (config.env !== 'test') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    )
  }));
}

module.exports = logger;
