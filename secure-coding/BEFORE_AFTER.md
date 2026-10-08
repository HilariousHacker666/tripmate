# Secure Coding Refactoring: Before & After Analysis (Exam Phase 12)

This document analyzes the intentional security flaws present in the initial implementation of the TripMate Expense creation endpoint (`/secure-coding/before/expenseController.js`) and documents the remediation techniques implemented in the production version (`/secure-coding/after/expenseController.js` and `src/routes/expenses.js`).

---

## 1. Vulnerability Summary Matrix

| ID | Vulnerability | CWE | Severity | Initial Implementation (Before) | Remediated Implementation (After) |
|---|---|---|---|---|---|
| **V-01** | SQL Injection | [CWE-89](https://cwe.mitre.org/data/definitions/89.html) | **Critical** (CVSS 9.8) | Direct string concatenation into raw SQL statement: `INSERT INTO Expenses ... VALUES ('" + paid_by + "')` | Parameterized Prepared Statements: `db.prepare('INSERT ... VALUES (?, ?, ...)')` with bound parameters |
| **V-02** | Broken Object Level Authorization (BOLA / IDOR) | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) | **High** (CVSS 8.5) | No ownership or trip membership validation; any caller could post expenses to any `tripId` | Server-side middleware `requireTripRole(['OWNER', 'EDITOR'])` validates membership and role |
| **V-03** | Lack of Input Validation & Sanitization | [CWE-20](https://cwe.mitre.org/data/definitions/20.html) | **Medium** (CVSS 6.5) | Negative amounts, oversized strings, and arbitrary categories accepted | `express-validator` schema enforcing positive float amounts, ISO 8601 dates, and enum categories |
| **V-04** | Information Exposure via Error Messages | [CWE-209](https://cwe.mitre.org/data/definitions/209.html) | **Medium** (CVSS 5.3) | Returns `err.message` and the raw `sql` string directly in HTTP 500 response | Generic client error (`An internal server error occurred`); full stack logged internally to Winston |
| **V-05** | Missing Security Audit Logging | [CWE-778](https://cwe.mitre.org/data/definitions/778.html) | **Low / Medium** (CVSS 4.3) | Financial transactions inserted silently without recording user, IP, or timestamp | `logAudit()` records user ID, trip ID, action, amount, IP address, and timestamp |

---

## 2. In-Depth Technical Walkthrough

### 2.1 Flaw 1: SQL Injection (CWE-89)
- **Before:**
  ```javascript
  const sql = "INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date) " +
    "VALUES ('" + Math.random().toString(36).substring(7) + "', '" + tripId + "', " +
    amount + ", '" + currency + "', '" + category + "', '" + description + "', '" + paid_by + "', '" + date + "');";
  db.exec(sql);
  ```
- **Exploitation:**
  An attacker sets the `paid_by` JSON field to:
  ```json
  { "paid_by": "Attacker', '2026-01-01'); DROP TABLE Users; --" }
  ```
  The resulting query terminates the insert and executes a destructive DROP TABLE command, causing permanent data loss.
- **After (Remediated):**
  ```javascript
  const stmt = db.prepare(`
    INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, req.params.tripId, amount, curr, category, description, paid_by, date);
  ```
  Parameterized placeholders ensure that input values are treated strictly as data literals by the SQLite query engine, eliminating code injection risk.

---

### 2.2 Flaw 2: Broken Object-Level Authorization (CWE-639 / BOLA)
- **Before:**
  The endpoint trusted the URL parameter `:tripId` and performed no checks to verify whether the requesting user owned or collaborated on the trip, or if their assigned role permitted adding financial records.
- **After (Remediated):**
  ```javascript
  router.post('/expenses', requireTripRole(['OWNER', 'EDITOR']), expenseValidation, ...)
  ```
  The `requireTripRole` middleware:
  1. Resolves the caller's verified identity from the cryptographic JWT session.
  2. Executes a parameterized query against `TripMembers` joining `Trips`.
  3. Returns a clean HTTP `404 Not Found` if the user is not a collaborator (preventing trip existence discovery).
  4. Returns `403 Forbidden` if the user's role is `VIEWER` (read-only).

---

### 2.3 Flaw 3: Input Validation & Boundary Checks (CWE-20)
- **Before:**
  The application allowed negative amounts (e.g., `-99999.00` distorting trip budgets), arbitrary categories, and unescaped HTML strings capable of triggering stored Cross-Site Scripting (XSS).
- **After (Remediated):**
  ```javascript
  const expenseValidation = [
    param('tripId').isUUID(),
    body('amount').isFloat({ gt: 0 }).withMessage('Must be positive float'),
    body('category').isIn(['Accommodation', 'Transport', 'Food', 'Activities', 'Shopping', 'Other']),
    body('description').isString().trim().isLength({ min: 1, max: 200 }).escape(),
    body('date').isISO8601()
  ];
  ```

---

## 3. Verification & Verification Evidence
Unit and negative security tests in `tests/integration/security.test.js` verify both sides of this behavior:
- SQL injection payloads (`' OR 1=1 --`) are safely stored as escaped literal strings without executing SQL commands.
- Viewers attempting to add expenses receive `403 Forbidden`.
- Users not part of the trip receive `404 Not Found`.
