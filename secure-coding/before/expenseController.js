// VULNERABLE INITIAL VERSION (Before Secure Coding Refactoring)
// Exam Phase 12 Security Flaws:
// 1. SQL Injection: Direct string concatenation of user-controlled inputs into the query
// 2. Broken Object Level Authorization (BOLA/IDOR): No validation that req.user is a collaborator on the trip
// 3. No Input Validation: Negative amounts or arbitrary strings permitted
// 4. Missing Audit Logging: State changes happen silently without traceability

const express = require('express');
const router = express.Router({ mergeParams: true });

module.exports = function(db) {
  // Vulnerable endpoint to add an expense
  router.post('/expenses', (req, res) => {
    const tripId = req.params.tripId;
    const { amount, currency, category, description, paid_by, date } = req.body;

    // VULNERABILITY 1: Direct SQL string concatenation (SQL Injection)
    // An attacker can pass `paid_by` = "Alice', '2026-01-01'); DROP TABLE Users; --"
    const sql = "INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date) " +
      "VALUES ('" + Math.random().toString(36).substring(7) + "', '" + tripId + "', " +
      amount + ", '" + currency + "', '" + category + "', '" + description + "', '" + paid_by + "', '" + date + "');";

    try {
      // VULNERABILITY 2: No permission/role check! Any logged-in user (or anonymous if unauthenticated) can insert!
      db.exec(sql);
      res.json({ success: true, message: 'Expense added (vulnerable)' });
    } catch (err) {
      // VULNERABILITY 3: Information leakage of database error / stack trace
      res.status(500).json({ error: err.message, query: sql });
    }
  });

  return router;
};
