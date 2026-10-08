# Software Defect Report (TripMate - 24CYS401)

| Field | Detail |
|---|---|
| **Defect ID** | **DEF-01** |
| **Title** | SQLite Syntax Error in Collaborator Role Promotion Endpoint (`no such column: "now"`) |
| **Severity** | **High** (Blocks core collaboration workflow & privilege updates) |
| **Component** | `src/routes/trips.js` -> `PUT /api/trips/:tripId/collaborators/:userId` |
| **Discovered In** | Integration Testing Phase (`tests/integration/collaboration.test.js`) |
| **Requirement Ref**| **FR-07, SR-02** (Collaborator permission management) |

---

## 1. Description & Reproduction Steps
### Steps to Reproduce:
1. Authenticate as the trip `OWNER`.
2. Share trip with another user as `VIEWER`.
3. Send HTTP `PUT /api/trips/:tripId/collaborators/:userId` with payload `{"role": "EDITOR"}` to promote the collaborator.

### Expected Behavior:
The database record in `TripMembers` is updated with `role = 'EDITOR'` and `updated_at` refreshed with the current timestamp. The server returns HTTP `200 OK`.

### Actual Behavior:
The server returned HTTP `500 Internal Server Error`.
Server error log (`logs/error.log`):
```text
SqliteError: no such column: "now" - should this be a string literal in single-quotes?
    at Database.prepare (src/routes/trips.js:312:8)
```

---

## 2. Root Cause Analysis
In SQL dialect (specifically SQLite ANSI standards):
- Double quotes `"` are treated as identifiers (column or table names).
- Single quotes `'` denote string literals.

In `src/routes/trips.js`, line 312:
```javascript
// DEFECTIVE CODE:
db.prepare('UPDATE TripMembers SET role = ?, updated_at = datetime("now") WHERE trip_id = ? AND user_id = ?')
```
SQLite interpreted `"now"` as a reference to a table column named `now`, rather than the string literal argument to the `datetime()` SQL built-in function.

---

## 3. Remediation & Fix
The query string was refactored to pass `'now'` enclosed in single quotes:
```javascript
// REMEDIATED CODE:
db.prepare("UPDATE TripMembers SET role = ?, updated_at = datetime('now') WHERE trip_id = ? AND user_id = ?")
  .run(role, tripId, targetUserId);
```

---

## 4. Retest & Verification Evidence
The automated test suite was re-executed:
```text
PASS tests/integration/collaboration.test.js
  Integration Test: Collaboration Lifecycle & Role Progression
    √ IT-01: Owner creates a new collaborative trip (8 ms)
    √ IT-02: Owner shares the trip with collaborator as VIEWER (6 ms)
    √ IT-03: VIEWER tries to add an expense and gets 403 Forbidden (6 ms)
    √ IT-04: Owner upgrades collaborator role from VIEWER to EDITOR (5 ms)
    √ IT-05: Promoted EDITOR now successfully creates the expense (6 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```
**Status: CLOSED / VERIFIED**
