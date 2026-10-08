const logger = require('../utils/logger');
const config = require('../config');

// Centralized error handling middleware
// Prevents stack trace disclosure to users, logs full error details on the server
function errorHandler(err, req, res, _next) {
  logger.error('Unhandled Application Error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Client gets a generic message to prevent information leakage
  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 
      ? 'An internal server error occurred. Please try again later.' 
      : err.message,
    ...(config.env === 'development' ? { debug: err.message } : {})
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Resource not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
