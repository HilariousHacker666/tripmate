const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTripRole } = require('../middleware/rbac');
const { 
  tripCreateValidation, 
  tripUpdateValidation, 
  shareTripValidation, 
  updateRoleValidation 
} = require('../middleware/validate');
const { logAudit } = require('../services/auditService');

const router = express.Router();

// All trip routes require an authenticated user
router.use(requireAuth);

/**
 * GET /api/trips
 * Privacy requirement: Users ONLY see trips they own or that are shared with them
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const trips = db.prepare(`
      SELECT t.id, t.title, t.description, t.start_date, t.end_date, t.budget, t.created_at, tm.role,
             (SELECT COUNT(*) FROM TripMembers WHERE trip_id = t.id) as member_count,
             (SELECT COUNT(*) FROM Destinations WHERE trip_id = t.id) as destination_count,
             (SELECT COALESCE(SUM(amount), 0) FROM Expenses WHERE trip_id = t.id) as total_expenses
      FROM Trips t
      INNER JOIN TripMembers tm ON tm.trip_id = t.id AND tm.user_id = ?
      ORDER BY t.start_date ASC
    `).all(req.user.id);

    res.json({
      success: true,
      data: trips
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips
 * Create trip: user automatically assigned 'OWNER'
 */
router.post('/', tripCreateValidation, (req, res, next) => {
  try {
    const { title, description, startDate, endDate, budget } = req.body;
    const db = getDb();
    const tripId = uuidv4();
    const memberId = uuidv4();

    // Use transaction for atomic insertion of trip and owner membership
    const createTripTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO Trips (id, title, description, start_date, end_date, budget, owner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(tripId, title, description || '', startDate, endDate, budget || 0.0, req.user.id);

      db.prepare(`
        INSERT INTO TripMembers (id, trip_id, user_id, role)
        VALUES (?, ?, ?, 'OWNER')
      `).run(memberId, tripId, req.user.id);
    });

    createTripTx();

    logAudit({
      tripId,
      userId: req.user.id,
      action: 'TRIP_CREATE',
      details: { title, budget },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Trip created successfully.',
      data: {
        id: tripId,
        title,
        description,
        startDate,
        endDate,
        budget: budget || 0,
        role: 'OWNER'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:tripId
 * Accessible by OWNER, EDITOR, VIEWER
 */
router.get('/:tripId', requireTripRole(['OWNER', 'EDITOR', 'VIEWER']), (req, res, next) => {
  try {
    const db = getDb();
    const trip = db.prepare(`
      SELECT t.id, t.title, t.description, t.start_date, t.end_date, t.budget, t.owner_id, t.created_at, tm.role
      FROM Trips t
      INNER JOIN TripMembers tm ON tm.trip_id = t.id AND tm.user_id = ?
      WHERE t.id = ?
    `).get(req.user.id, req.params.tripId);

    // Get collaborators
    const collaborators = db.prepare(`
      SELECT tm.user_id, tm.role, tm.created_at, u.name, u.email
      FROM TripMembers tm
      INNER JOIN Users u ON u.id = tm.user_id
      WHERE tm.trip_id = ?
      ORDER BY tm.created_at ASC
    `).all(req.params.tripId);

    // Get summary of expenses
    const expenseSummary = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM Expenses
      WHERE trip_id = ?
      GROUP BY category
    `).all(req.params.tripId);

    const totalExpenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as grand_total FROM Expenses WHERE trip_id = ?
    `).get(req.params.tripId);

    res.json({
      success: true,
      data: {
        ...trip,
        collaborators,
        expenseSummary,
        totalExpenses: totalExpenseRow.grand_total,
        userRole: req.tripRole
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/trips/:tripId
 * Accessible by OWNER, EDITOR
 */
router.put('/:tripId', requireTripRole(['OWNER', 'EDITOR']), tripUpdateValidation, (req, res, next) => {
  try {
    const { title, description, startDate, endDate, budget } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM Trips WHERE id = ?').get(req.params.tripId);

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedStart = startDate !== undefined ? startDate : existing.start_date;
    const updatedEnd = endDate !== undefined ? endDate : existing.end_date;
    const updatedBudget = budget !== undefined ? budget : existing.budget;

    db.prepare(`
      UPDATE Trips 
      SET title = ?, description = ?, start_date = ?, end_date = ?, budget = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedTitle, updatedDesc, updatedStart, updatedEnd, updatedBudget, req.params.tripId);

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'TRIP_UPDATE',
      details: { title: updatedTitle },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Trip updated successfully.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId
 * Accessible ONLY by OWNER
 */
router.delete('/:tripId', requireTripRole(['OWNER']), (req, res, next) => {
  try {
    const db = getDb();
    
    // Cascades take care of child tables
    db.prepare('DELETE FROM Trips WHERE id = ?').run(req.params.tripId);

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'TRIP_DELETE',
      details: { tripId: req.params.tripId },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Trip deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:tripId/collaborators
 * Share a trip with another user by email. Accessible ONLY by OWNER.
 * Prevent privilege escalation: EDITOR cannot invite.
 */
router.post('/:tripId/collaborators', requireTripRole(['OWNER']), shareTripValidation, (req, res, next) => {
  try {
    const { email, role } = req.body;
    const db = getDb();

    // Look up collaborator by email
    const targetUser = db.prepare('SELECT id, email, name FROM Users WHERE email = ?').get(email);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User with this email not found. Collaborators must be registered on TripMate.'
      });
    }

    // Check if already a collaborator
    const existing = db.prepare('SELECT role FROM TripMembers WHERE trip_id = ? AND user_id = ?')
      .get(req.params.tripId, targetUser.id);
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `User is already a collaborator on this trip with role ${existing.role}.`
      });
    }

    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO TripMembers (id, trip_id, user_id, role)
      VALUES (?, ?, ?, ?)
    `).run(memberId, req.params.tripId, targetUser.id, role);

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'COLLABORATOR_SHARE',
      details: { collaboratorId: targetUser.id, email, role },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: `Trip successfully shared with ${targetUser.name} as ${role}.`,
      data: {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/trips/:tripId/collaborators/:userId
 * Change permission of collaborator. Accessible ONLY by OWNER.
 * Prevent privilege escalation: The last OWNER cannot be removed or demoted.
 */
router.put('/:tripId/collaborators/:userId', requireTripRole(['OWNER']), updateRoleValidation, (req, res, next) => {
  try {
    const { role } = req.body;
    const { tripId, userId: targetUserId } = req.params;
    const db = getDb();

    const existingMember = db.prepare('SELECT role FROM TripMembers WHERE trip_id = ? AND user_id = ?')
      .get(tripId, targetUserId);

    if (!existingMember) {
      return res.status(404).json({
        success: false,
        error: 'Collaborator not found on this trip.'
      });
    }

    // If demoting from OWNER to non-owner, ensure there is at least one other OWNER remaining
    if (existingMember.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = db.prepare("SELECT COUNT(*) as count FROM TripMembers WHERE trip_id = ? AND role = 'OWNER'")
        .get(tripId).count;
      
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Security constraint: Cannot demote the last OWNER of a trip. Promote another collaborator first.'
        });
      }
    }

    db.prepare("UPDATE TripMembers SET role = ?, updated_at = datetime('now') WHERE trip_id = ? AND user_id = ?")
      .run(role, tripId, targetUserId);

    logAudit({
      tripId,
      userId: req.user.id,
      action: 'COLLABORATOR_ROLE_CHANGE',
      details: { targetUserId, oldRole: existingMember.role, newRole: role },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: `Collaborator permission updated to ${role}.`
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId/collaborators/:userId
 * Revoke permission. Accessible ONLY by OWNER.
 * Prevent removing the last owner.
 */
router.delete('/:tripId/collaborators/:userId', requireTripRole(['OWNER']), (req, res, next) => {
  try {
    const { tripId, userId: targetUserId } = req.params;
    const db = getDb();

    const existingMember = db.prepare('SELECT role FROM TripMembers WHERE trip_id = ? AND user_id = ?')
      .get(tripId, targetUserId);

    if (!existingMember) {
      return res.status(404).json({
        success: false,
        error: 'Collaborator not found on this trip.'
      });
    }

    // Check if revoking the last OWNER
    if (existingMember.role === 'OWNER') {
      const ownerCount = db.prepare("SELECT COUNT(*) as count FROM TripMembers WHERE trip_id = ? AND role = 'OWNER'")
        .get(tripId).count;
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Security constraint: Cannot remove the last OWNER of a trip.'
        });
      }
    }

    db.prepare('DELETE FROM TripMembers WHERE trip_id = ? AND user_id = ?').run(tripId, targetUserId);

    logAudit({
      tripId,
      userId: req.user.id,
      action: 'COLLABORATOR_REVOKE',
      details: { revokedUserId: targetUserId, priorRole: existingMember.role },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Collaborator removed successfully.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:tripId/audit-logs
 * Accessible ONLY by OWNER
 */
router.get('/:tripId/audit-logs', requireTripRole(['OWNER']), (req, res, next) => {
  try {
    const db = getDb();
    const logs = db.prepare(`
      SELECT al.id, al.action, al.details, al.ip_address, al.timestamp, u.name as user_name, u.email as user_email
      FROM AuditLogs al
      LEFT JOIN Users u ON u.id = al.user_id
      WHERE al.trip_id = ?
      ORDER BY al.timestamp DESC
      LIMIT 100
    `).all(req.params.tripId);

    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
