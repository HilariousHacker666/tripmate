const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const logger = require('../utils/logger');

function logAudit({ tripId = null, userId = null, action, details = {}, ip = null, userAgent = null }) {
  try {
    const db = getDb();
    const id = uuidv4();
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

    const stmt = db.prepare(`
      INSERT INTO AuditLogs (id, trip_id, user_id, action, details, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(id, tripId, userId, action, detailsStr, ip, userAgent);

    // Also send structured log to Winston
    logger.info({
      auditEvent: true,
      auditId: id,
      tripId,
      userId,
      action,
      details,
      ip
    });
  } catch (err) {
    logger.error('Failed to write audit log', { error: err.message, action, tripId, userId });
  }
}

module.exports = {
  logAudit
};
