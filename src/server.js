const app = require('./app');
const config = require('./config');
const { getDb } = require('./db');
const logger = require('./utils/logger');

// Initialize database schema
getDb();

const server = app.listen(config.port, () => {
  logger.info(`TripMate Secure Server running on port ${config.port} in [${config.env}] mode`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('TripMate HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('TripMate HTTP server closed.');
    process.exit(0);
  });
});
