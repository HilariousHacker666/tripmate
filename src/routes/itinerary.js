const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTripRole, verifyItineraryBelongsToTrip } = require('../middleware/rbac');
const { itineraryValidation } = require('../middleware/validate');
const { logAudit } = require('../services/auditService');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/trips/:tripId/itinerary
 * Accessible by: OWNER, EDITOR, VIEWER
 */
router.get('/', requireTripRole(['OWNER', 'EDITOR', 'VIEWER']), (req, res, next) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT i.*, d.name as destination_name, d.country as destination_country
      FROM ItineraryItems i
      JOIN Destinations d ON d.id = i.destination_id
      WHERE i.trip_id = ?
      ORDER BY i.day ASC, i.time ASC
    `).all(req.params.tripId);

    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:tripId/itinerary
 * Accessible by: OWNER, EDITOR
 */
router.post('/', requireTripRole(['OWNER', 'EDITOR']), itineraryValidation, (req, res, next) => {
  try {
    const { destinationId, day, time, title, location, notes } = req.body;
    const db = getDb();

    // Verify destination belongs to the same trip (BOLA check)
    const dest = db.prepare('SELECT id FROM Destinations WHERE id = ? AND trip_id = ?').get(destinationId, req.params.tripId);
    if (!dest) {
      return res.status(400).json({
        success: false,
        error: 'The referenced destination does not belong to this trip.'
      });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO ItineraryItems (id, trip_id, destination_id, day, time, title, location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.tripId, destinationId, day, time, title, location || '', notes || '');

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'ITINERARY_CREATE',
      details: { itemId: id, title, day, time },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Itinerary item added successfully.',
      data: {
        id,
        trip_id: req.params.tripId,
        destination_id: destinationId,
        day,
        time,
        title,
        location,
        notes
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId/itinerary/:itemId
 * IDOR check + Role check (OWNER, EDITOR)
 */
router.delete('/:itemId', 
  requireTripRole(['OWNER', 'EDITOR']), 
  verifyItineraryBelongsToTrip, 
  (req, res, next) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM ItineraryItems WHERE id = ?').run(req.params.itemId);

      logAudit({
        tripId: req.params.tripId,
        userId: req.user.id,
        action: 'ITINERARY_DELETE',
        details: { itemId: req.params.itemId },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Itinerary item deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
