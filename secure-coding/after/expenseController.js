// REMEDIATED SECURE VERSION (After Secure Coding Refactoring)
// Exam Phase 12 Security Controls:
// 1. Parameterized Queries: Prepared statements with bound values prevent SQL injection
// 2. Strict RBAC / IDOR Protection: requireTripRole middleware checks role (OWNER or EDITOR)
// 3. Input Validation: express-validator enforces type, positive float amount, valid category enum, safe lengths
// 4. Traceable Audit Logging: Every expense creation is recorded with IP and user ID

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireTripRole } = require('../../src/middleware/rbac');
const { expenseValidation } = require('../../src/middleware/validate');
const { logAudit } = require('../../src/services/auditService');

const router = express.Router({ mergeParams: true });

module.exports = function(db) {
  // Remediated endpoint: Protected by RBAC, schema validation, parameterized statements, and audit logging
  router.post('/expenses', 
    requireTripRole(['OWNER', 'EDITOR']), 
    expenseValidation, 
    (req, res, next) => {
      try {
        const { amount, currency, category, description, paid_by, date } = req.body;
        const id = uuidv4();
        const curr = currency || 'USD';

        // REMEDIATION 1: Parameterized SQL (Better-SQLite3 Prepared Statements)
        const stmt = db.prepare(`
          INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(id, req.params.tripId, amount, curr, category, description, paid_by, date);

        // REMEDIATION 2: Audit Logging for traceability
        logAudit({
          tripId: req.params.tripId,
          userId: req.user.id,
          action: 'EXPENSE_CREATE',
          details: { expenseId: id, amount, category },
          ip: req.ip,
          userAgent: req.get('user-agent')
        });

        res.status(201).json({
          success: true,
          message: 'Expense added securely.',
          data: { id, tripId: req.params.tripId, amount, currency: curr, category, description, paid_by, date }
        });
      } catch (err) {
        // REMEDIATION 3: Generic error handling (prevent information disclosure)
        next(err);
      }
    }
  );

  return router;
};
