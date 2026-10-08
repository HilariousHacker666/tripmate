# 10. Sprint Metrics, Burndown & Jira Export

## 1. Scrum Board Workflow
Board Columns:
`[ TO DO ]` &rarr; `[ IN PROGRESS ]` &rarr; `[ TESTING / CODE REVIEW ]` &rarr; `[ DONE ]`

- **Definition of Done (DoD):**
  1. Automated Jest unit, integration, and security tests pass with 0 failures.
  2. Input validation and parameterized query constraints verified.
  3. Security event logged via `logAudit()`.
  4. Code reviewed against OWASP Secure Coding Practices.

---

## 2. Daily Scrum Log (Sprint 2, Day 7)
- **Alice (Security Lead):** Completed Double-submit CSRF middleware; resolved SQLite datetime bug during integration testing (DEF-01); currently executing fuzzing test harness.
- **Bob (Backend Engineer):** Built expense aggregation endpoint and BOLA checks for destinations and itinerary; assisting Alice with test suite.
- **Charlie (Frontend Engineer):** Implemented Black & White theme, role badges, and pure SVG expense chart; verified accessibility contrast ratios.
- **Impediments:** Resolved SQLite `'now'` datetime syntax error that briefly failed role promotion integration test.

---

## 3. Sprint 2 Burndown Data & Visual Chart

### Burndown Data Table
| Day | Estimated Story Points Remaining | Ideal Burndown Trend | Actual Story Points Completed | Notes |
|---|---|---|---|---|
| Day 1 | 26 | 26.0 | 0 | Sprint Planning completed |
| Day 3 | 21 | 20.8 | 5 | Destinations API & RBAC tested |
| Day 5 | 15 | 15.6 | 6 | Itinerary timeline completed |
| Day 7 | 8 | 10.4 | 7 | Expenses & SVG chart completed |
| Day 9 | 2 | 5.2 | 6 | DEF-01 resolved, tests passing |
| Day 10 | 0 | 0.0 | 2 | Fuzzing & K8s manifests verified |

### ASCII Burndown Chart
```text
Points
  26 | *  (Actual)
  20 |    *
  15 |       *
  10 |          *
   5 |             *
   0 +----------------*---
     D1  D3  D5  D7  D9  D10
```

---

## 4. Sprint Review & Retrospective
- **Velocity:** 26 story points delivered in Sprint 2.
- **Defects Discovered:** 1 defect (DEF-01: SQLite datetime function syntax error) caught in integration testing and remediated immediately.
- **Carry-over:** 0 story points.
- **Retrospective Actions:**
  1. *Action 1:* Enforce automated SQL syntax verification in linting pipelines to catch quote discrepancies early.
  2. *Action 2:* Maintain automated fuzzing in GitHub Actions CI to catch edge cases prior to staging deployments.
