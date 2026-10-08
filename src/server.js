const app = require('./app');
const config = require('./config');
const { getDb } = require('./db');
const logger = require('./utils/logger');

// Initialize database schema and auto-seed demo accounts if empty
try {
  logger.info('Initializing TripMate database connection and schema...');
  const db = getDb();
  logger.info('TripMate database initialized successfully.');

  const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get().count;
  if (userCount === 0) {
    logger.info('No existing users detected. Auto-seeding demo accounts (owner, editor, viewer)...');
    const { seed } = require('./db/seed');
    seed().then(() => {
      logger.info('Demo accounts auto-seeded successfully.');
    }).catch(err => {
      logger.error('Failed to auto-seed demo accounts', { error: err.message });
    });
  } else {
    logger.info(`Database already contains ${userCount} user accounts.`);
  }
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
