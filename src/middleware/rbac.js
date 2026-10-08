const { getDb } = require('../db');
const { logAudit } = require('../services/auditService');

/**
 * Reusable RBAC & Authorization Middleware
 * Enforces role requirement while preventing IDOR/BOLA.
 * Returns 404 for non-existent trips or trips user has no access to (preventing existence enumeration).
 * 
 * @param {Array<string>} allowedRoles e.g. ['OWNER'], ['OWNER', 'EDITOR'], ['OWNER', 'EDITOR', 'VIEWER']
 */
function requireTripRole(allowedRoles = ['OWNER', 'EDITOR', 'VIEWER']) {
  return (req, res, next) => {
    const tripId = req.params.tripId || req.params.id || req.body.tripId;
    const userId = req.user?.id;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required tripId parameter.'
      });
    }

    const db = getDb();

    // Query membership. Note: Trip owner is always also recorded in TripMembers or Trips.
    // In our schema, trip owner is added to TripMembers with role='OWNER' on trip creation.
    const member = db.prepare(`
      SELECT tm.role, t.title, t.owner_id
      FROM Trips t
      LEFT JOIN TripMembers tm ON tm.trip_id = t.id AND tm.user_id = ?
      WHERE t.id = ?
    `).get(userId, tripId);

    // If trip does not exist OR user is not a member of the trip:
    // Security Rule: Return 404 (NOT 403) to prevent resource enumeration / existence leaking
    if (!member || !member.role) {
      logAudit({
        tripId,
        userId,
        action: 'ACCESS_DENIED_NOT_FOUND',
        details: { attemptedAction: req.method + ' ' + req.originalUrl },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(404).json({
        success: false,
        error: 'Trip not found.'
      });
    }

    // Check if the user's role is sufficient
    if (!allowedRoles.includes(member.role)) {
      logAudit({
        tripId,
        userId,
        action: 'ACCESS_DENIED_FORBIDDEN',
        details: {
          userRole: member.role,
          requiredRoles: allowedRoles,
          method: req.method,
          path: req.originalUrl
        },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(403).json({
        success: false,
        error: `Forbidden. Action requires role: ${allowedRoles.join(' or ')}. Your role is ${member.role}.`
      });
    }

    // Attach role and trip details to req for downstream route handlers
    req.tripRole = member.role;
    req.trip = {
      id: tripId,
      title: member.title,
      ownerId: member.owner_id
    };

    next();
  };
}

/**
 * IDOR / BOLA Prevention helper for child resources:
 * Verifies that a destination belongs to the specified trip.
 */
function verifyDestinationBelongsToTrip(req, res, next) {
  const { tripId, destinationId } = req.params;
  const db = getDb();

  const dest = db.prepare('SELECT id, trip_id FROM Destinations WHERE id = ?').get(destinationId);
  if (!dest || dest.trip_id !== tripId) {
    return res.status(404).json({
      success: false,
      error: 'Destination not found in this trip.'
    });
  }

  next();
}

/**
 * IDOR / BOLA Prevention helper for Itinerary item:
 * Verifies that an itinerary item belongs to the specified trip.
 */
function verifyItineraryBelongsToTrip(req, res, next) {
  const { tripId, itemId } = req.params;
  const db = getDb();

  const item = db.prepare('SELECT id, trip_id FROM ItineraryItems WHERE id = ?').get(itemId);
  if (!item || item.trip_id !== tripId) {
    return res.status(404).json({
      success: false,
      error: 'Itinerary item not found in this trip.'
    });
  }

  next();
}

/**
 * IDOR / BOLA Prevention helper for Expense:
 * Verifies that an expense belongs to the specified trip.
 */
function verifyExpenseBelongsToTrip(req, res, next) {
  const { tripId, expenseId } = req.params;
  const db = getDb();

  const exp = db.prepare('SELECT id, trip_id FROM Expenses WHERE id = ?').get(expenseId);
  if (!exp || exp.trip_id !== tripId) {
    return res.status(404).json({
      success: false,
      error: 'Expense record not found in this trip.'
    });
  }

  next();
}

module.exports = {
  requireTripRole,
  verifyDestinationBelongsToTrip,
  verifyItineraryBelongsToTrip,
  verifyExpenseBelongsToTrip
};
