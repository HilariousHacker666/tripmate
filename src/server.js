const app = require('./app');
const config = require('./config');
const { getDb } = require('./db');
const logger = require('./utils/logger');

// Initialize database schema
try {
  logger.info('Initializing TripMate database connection and schema...');
  getDb();
  logger.info('TripMate database initialized successfully.');
} catch (dbErr) {
  logger.error('CRITICAL: Failed to initialize SQLite database', { error: dbErr.message, stack: dbErr.stack });
  process.exit(1);
}

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`TripMate Secure Server running on http://0.0.0.0:${config.port} in [${config.env}] mode`);
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
