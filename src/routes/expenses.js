const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTripRole, verifyExpenseBelongsToTrip } = require('../middleware/rbac');
const { expenseValidation } = require('../middleware/validate');
const { logAudit } = require('../services/auditService');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/trips/:tripId/expenses
 * Accessible by: OWNER, EDITOR, VIEWER
 * Returns all expenses, total, and per-category breakdown
 */
router.get('/', requireTripRole(['OWNER', 'EDITOR', 'VIEWER']), (req, res, next) => {
  try {
    const db = getDb();
    const expenses = db.prepare(`
      SELECT * FROM Expenses
      WHERE trip_id = ?
      ORDER BY date DESC, created_at DESC
    `).all(req.params.tripId);

    const categorySummary = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM Expenses
      WHERE trip_id = ?
      GROUP BY category
    `).all(req.params.tripId);

    const totalRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM Expenses
      WHERE trip_id = ?
    `).get(req.params.tripId);

    res.json({
      success: true,
      data: {
        expenses,
        total: totalRow.total,
        categorySummary
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:tripId/expenses
 * Accessible by: OWNER, EDITOR
 * Secure implementation: Parameterized SQL, UUID, strict validation, positive check
 */
router.post('/', requireTripRole(['OWNER', 'EDITOR']), expenseValidation, (req, res, next) => {
  try {
    const { amount, currency, category, description, paid_by, date } = req.body;
    const db = getDb();
    const id = uuidv4();
    const curr = currency || 'USD';

    // Parameterized SQL query
    db.prepare(`
      INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.tripId, amount, curr, category, description, paid_by, date);

    logAudit({
      tripId: req.params.tripId,
      userId: req.user.id,
      action: 'EXPENSE_CREATE',
      details: { expenseId: id, amount, category, currency: curr },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully.',
      data: {
        id,
        trip_id: req.params.tripId,
        amount,
        currency: curr,
        category,
        description,
        paid_by,
        date
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId/expenses/:expenseId
 * IDOR check + Role check (OWNER, EDITOR)
 */
router.delete('/:expenseId',
  requireTripRole(['OWNER', 'EDITOR']),
  verifyExpenseBelongsToTrip,
  (req, res, next) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM Expenses WHERE id = ?').run(req.params.expenseId);

      logAudit({
        tripId: req.params.tripId,
        userId: req.user.id,
        action: 'EXPENSE_DELETE',
        details: { expenseId: req.params.expenseId },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Expense deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
