const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/audit-logs
 * Retrieves user-relevant audit events across all trips they own, plus user auth actions
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    
    // Fetch logs for trips owned by the user, or events where user is the actor
    const logs = db.prepare(`
      SELECT al.id, al.trip_id, al.user_id, al.action, al.details, al.ip_address, al.timestamp,
             t.title as trip_title, u.name as actor_name, u.email as actor_email
      FROM AuditLogs al
      LEFT JOIN Trips t ON t.id = al.trip_id
      LEFT JOIN Users u ON u.id = al.user_id
      WHERE al.user_id = ? 
         OR al.trip_id IN (SELECT trip_id FROM TripMembers WHERE user_id = ? AND role = 'OWNER')
      ORDER BY al.timestamp DESC
      LIMIT 100
    `).all(req.user.id, req.user.id);

    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
