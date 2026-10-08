# 01. Agile & Scrum Process with Extreme Programming (XP) Practices

## 1. Methodology Justification: Scrum + XP Hybrid
TripMate is engineered utilizing a Scrum framework enriched with Extreme Programming (XP) engineering practices. While Scrum provides predictable cadences (two-week sprints, Daily Scrums, Sprint Reviews, and Retrospectives), XP integrates rigorous software engineering controls essential for a high-integrity Secure Software Engineering course (24CYS401):
- **Test-Driven Development (TDD):** Writing automated unit/integration tests before or alongside code ensures boundary constraints and security assertion rules are preserved.
- **Continuous Integration (CI):** Immediate automated linting, security scanning, and test execution on every commit.
- **Refactoring:** Continuous code improvement to eliminate technical and security debt.
- **Pair Programming / Mandatory Peer Review:** Ensuring that all security-critical authorization logic is peer-reviewed and signed off.

---

## 2. Mapping Agile Manifesto Principles to TripMate

| Agile Principle | TripMate Security Implementation |
|---|---|
| **1. Early and continuous delivery of valuable software** | Deliver runnable increments of TripMate each sprint with core RBAC security gates verified by automated pipelines. |
| **2. Welcome changing requirements, even late in development** | Modular middleware architecture (`requireTripRole`, `csrfProtection`) allows permission rules and security policies to evolve without breaking existing API routes. |
| **3. Working software is the primary measure of progress** | Every sprint deliverable must pass automated security negative tests, regression tests, and fuzzing checks before deployment. |
| **4. Technical excellence and good design enhance agility** | Clean architecture, layered separation of concerns, and parameterized queries eliminate regressions and prevent security bottlenecks. |
| **5. Build projects around motivated individuals and provide environment/support** | Blameless post-mortems and traceable security audit trails empower developers to identify and remediate security vulnerabilities promptly. |

---

## 3. Refactoring Examples with Before / After

### Refactoring Example 1: Eliminating SQL Injection & Centralizing Authorization (RF-01)
- **Before:** Direct SQL string interpolation inside endpoint handler without authorization checks:
  ```javascript
  // Before: Vulnerable and coupled
  const sql = "INSERT INTO Expenses (id, amount) VALUES ('" + id + "', " + amount + ")";
  db.exec(sql);
  ```
- **After:** Parameterized prepared statement wrapped in reusable RBAC middleware:
  ```javascript
  // After: Secure, parameterized, and decoupled
  router.post('/expenses', requireTripRole(['OWNER', 'EDITOR']), expenseValidation, (req, res) => {
    db.prepare('INSERT INTO Expenses (id, amount) VALUES (?, ?)').run(id, amount);
  });
  ```
- **Benefit:** Eliminated SQL injection risk (CWE-89) and centralized role-based authorization logic.

### Refactoring Example 2: Hardened Authentication Error Handling (RF-02)
- **Before:** Detailed database error returned directly to client in HTTP 500 response:
  ```javascript
  // Before: Information Disclosure (CWE-209)
  res.status(500).json({ error: err.message, query: sql });
  ```
- **After:** Centralized error-handling middleware:
  ```javascript
  // After: Generic client response, sanitized internal logging
  logger.error('Database query execution error', { error: err.message });
  res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  ```

---

## 4. Agile Risks & Mitigations

| Risk ID | Agile Risk Description | Impact | Mitigation Strategy |
|---|---|---|---|
| **R-01** | **Security Debt Accumulation:** Velocity pressure leading to deferred authorization checks or incomplete input validation. | High | Definition of Done (DoD) requires 100% pass on negative security tests, zero high/critical `npm audit` findings, and parameterized SQL verification. |
| **R-02** | **Scope Creep in Collaboration Roles:** Frequent changes to permission matrices causing inconsistent IDOR checks. | Medium | Use a single centralized middleware (`requireTripRole`) and maintain a single source of truth for permission tables in code and documentation. |
