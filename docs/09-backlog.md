# 09. Product Backlog & Sprint Planning

## 1. Epics Overview
- **EPIC-1: Identity, Authentication & Session Security (AUTH)**
- **EPIC-2: Trip Lifecycle & Multi-Resource Planning (CORE)**
- **EPIC-3: Granular Role-Based Access Control & Collaboration (RBAC)**
- **EPIC-4: Security Auditing, Hardening & Compliance (SEC)**

---

## 2. Product Backlog (12+ User Stories)

| Story ID | Epic | User Story | Priority | Story Points | Acceptance Criteria |
|---|---|---|---|---|---|
| **US-01** | EPIC-1 | As a new traveler, I want to register an account with a strong password, so that my trip plans are protected. | Must Have | 3 | Password >= 10 chars, complexity regex, bcrypt cost >= 12, email normalization. |
| **US-02** | EPIC-1 | As a user, I want to authenticate and receive an HttpOnly JWT cookie, so that my session is protected from XSS theft. | Must Have | 5 | Token valid for 15 min, HttpOnly, SameSite=Strict, secure flag in production. |
| **US-03** | EPIC-1 | As a security admin, I want accounts locked after 5 failed logins, so that brute-force credential stuffing is blocked. | Must Have | 3 | Returns 403 on lockout, unlocks after 15 min. |
| **US-04** | EPIC-2 | As an owner, I want to create and manage trips with budgets, so that I can organize travel itineraries. | Must Have | 5 | Start date <= end date, budget >= 0, automatic OWNER assignment. |
| **US-05** | EPIC-2 | As an editor, I want to add destinations to a trip, so that we know our travel stops. | Must Have | 3 | UUID validation, arrival <= departure dates, sanitized text. |
| **US-06** | EPIC-2 | As an editor, I want to create itinerary activities linked to destinations, so that we have an organized timeline. | Must Have | 5 | Day ISO 8601, time 24h format, destination verified to belong to trip. |
| **US-07** | EPIC-2 | As an editor, I want to record expenses with categories, so that our team can track spending against budget. | Must Have | 5 | Amount > 0, valid category enum, parameterized SQL. |
| **US-08** | EPIC-3 | As an owner, I want to invite collaborators via email with OWNER, EDITOR, or VIEWER roles. | Must Have | 5 | Validates target user exists, prevents duplicate membership, writes audit log. |
| **US-09** | EPIC-3 | As an owner, I want to modify collaborator roles or revoke access, so that permissions stay up to date. | Must Have | 5 | Prevents removing or demoting the last OWNER of a trip. |
| **US-10** | EPIC-3 | As a viewer, I want to inspect trip details and itinerary without edit buttons, so that I don't submit unauthorized updates. | Must Have | 3 | UI disables edit buttons; server enforces 403 if direct write attempted. |
| **US-11** | EPIC-3 | As a traveler, I want unauthorized users to receive 404 when probing private trips, so our travel is private. | Must Have | 5 | `requireTripRole` returns 404 for inaccessible or non-existent trips. |
| **US-12** | EPIC-4 | As an owner, I want to review an audit log of trip actions, so that changes remain transparent and accountable. | Should Have | 3 | Chronological log of share, role change, revoke, and expense actions. |
| **US-13** | EPIC-4 | As a user, I want state-changing requests protected by CSRF tokens, so that cross-site exploits are prevented. | Must Have | 5 | Double-submit CSRF cookie matched against header on POST/PUT/DELETE. |

---

## 3. Sprint 1 Plan (Core Foundation & Security Baseline)
- **Sprint Goal:** Establish hardened authentication, secure database schema, and initial trip CRUD with RBAC.
- **Sprint Backlog Tasks:**
  - TASK-101: Configure Express with Helmet, CORS, and Winston structured logger.
  - TASK-102: Implement SQLite schema with WAL mode and foreign keys (`Users`, `Trips`, `TripMembers`).
  - TASK-103: Implement Registration & Login with bcrypt (cost >= 12) and 15-minute JWT cookie.
  - TASK-104: Implement account lockout logic for 5 consecutive failed logins.
  - TASK-105: Implement `requireTripRole` middleware and Trip CRUD routes.
  - TASK-106: Write Jest unit tests for password validator and RBAC middleware.

---

## 4. Sprint 2 Plan (Collaboration, Child Resources & Hardening)
- **Sprint Goal:** Complete collaborative planning sub-resources (destinations, itinerary, expenses), CSRF protection, and audit logging.
- **Sprint Backlog Tasks:**
  - TASK-201: Implement Double-Submit CSRF protection middleware.
  - TASK-202: Implement Destinations, Itinerary timeline, and Expenses routes.
  - TASK-203: Implement Collaborator management (Invite, Role Update, Revoke, Last Owner guard).
  - TASK-204: Build Black & White minimalist SPA frontend with dynamic SVG chart.
  - TASK-205: Implement security audit logging in database and Winston logs.
  - TASK-206: Execute negative security integration tests and automated fuzzing harness.
