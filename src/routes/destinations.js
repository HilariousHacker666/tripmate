const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTripRole, verifyDestinationBelongsToTrip } = require('../middleware/rbac');
const { destinationValidation } = require('../middleware/validate');
const { logAudit } = require('../services/auditService');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/trips/:tripId/destinations
 * Accessible by: OWNER, EDITOR, VIEWER
 */
router.get('/', requireTripRole(['OWNER', 'EDITOR', 'VIEWER']), (req, res, next) => {
  try {
    const db = getDb();
    const destinations = db.prepare(`
      SELECT * FROM Destinations 
      WHERE trip_id = ?
      ORDER BY arrival_date ASC
    `).all(req.params.tripId);

    res.json({
      success: true,
      data: destinations
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:tripId/destinations
 * Accessible by: OWNER, EDITOR
 */
router.post('/', requireTripRole(['OWNER', 'EDITOR']), destinationValidation, (req, res, next) => {
  try {
    const { name, country, arrivalDate, departureDate, notes } = req.body;
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO Destinations (id, trip_id, name, country, arrival_date, departure_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.tripId, name, country, arrivalDate, departureDate, notes || '');

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'DESTINATION_CREATE',
      details: { destinationId: id, name, country },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Destination added successfully.',
      data: {
        id,
        trip_id: req.params.tripId,
        name,
        country,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        notes
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId/destinations/:destinationId
 * IDOR check + Role check (OWNER, EDITOR)
 */
router.delete('/:destinationId', 
  requireTripRole(['OWNER', 'EDITOR']), 
  verifyDestinationBelongsToTrip, 
  (req, res, next) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM Destinations WHERE id = ?').run(req.params.destinationId);

      logAudit({
        tripId: req.params.tripId,
        userId: req.user.id,
        action: 'DESTINATION_DELETE',
        details: { destinationId: req.params.destinationId },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Destination deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
