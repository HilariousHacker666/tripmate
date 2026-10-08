# 02. Software Requirements Specification (SRS)

## 1. Stakeholders and Actors
- **OWNER:** Trip creator or promoted collaborator possessing full administrative authority over the trip (can share, revoke, modify permissions, delete trip, and inspect trip audit logs).
- **EDITOR:** Collaborator permitted to create, update, and delete trip sub-resources (destinations, itinerary items, expenses); cannot share or delete the trip.
- **VIEWER:** Collaborator with read-only permissions across trip details, destinations, itinerary timeline, and expenses.
- **ADMINISTRATOR:** Platform operations engineer responsible for container deployment, cluster hardening, and log monitoring.
- **ANONYMOUS VISITOR:** Unauthenticated end-user restricted to registration and login screens.

---

## 2. Requirements Table (Prioritized: FR, NFR, SR)

| Requirement ID | Type | Description | Priority |
|---|---|---|---|
| **FR-01** | Functional | User registration with name, email, and strong password | Must Have |
| **FR-02** | Functional | User login issuing short-lived JWT stored in HttpOnly cookie | Must Have |
| **FR-03** | Functional | Create, update, view, and delete trips with title, dates, budget | Must Have |
| **FR-04** | Functional | Manage destinations (name, country, arrival/departure dates, notes) | Must Have |
| **FR-05** | Functional | Manage itinerary timeline items linked to destinations | Must Have |
| **FR-06** | Functional | Record expenses with amount, category, currency, and date | Must Have |
| **FR-07** | Functional | Share trip with collaborators by email assigning OWNER, EDITOR, VIEWER | Must Have |
| **FR-08** | Functional | Owner can modify collaborator roles or revoke trip access | Must Have |
| **FR-09** | Functional | Visual black/white expense category breakdown chart | Should Have |
| **NFR-01** | Non-Functional | Response time under 200ms for all API queries | Must Have |
| **NFR-02** | Non-Functional | Strict Black & White minimal responsive design (WCAG AA compliant) | Must Have |
| **NFR-03** | Non-Functional | Offline runnable without cloud database dependencies (SQLite embedded) | Must Have |
| **SR-01** | Security | Password complexity (min 10 chars, uppercase, lowercase, digit, symbol, bcrypt >= 12) | Must Have |
| **SR-02** | Security | Reusable server-side RBAC middleware (`requireTripRole`) | Must Have |
| **SR-03** | Security | IDOR/BOLA prevention returning HTTP 404 for unauthorized trips | Must Have |
| **SR-04** | Security | Account lockout after 5 consecutive failed login attempts (15 min) | Must Have |
| **SR-05** | Security | Double-Submit CSRF protection on all state-modifying requests | Must Have |
| **SR-06** | Security | Parameterized SQL queries preventing SQL injection (CWE-89) | Must Have |
| **SR-07** | Security | Immutable security audit logging for authentication and authorization events | Must Have |
| **SR-08** | Security | Last OWNER protection (cannot remove or demote the last trip owner) | Must Have |

---

## 3. CIA Triad & Core Security Requirements

### Confidentiality (C)
- User data isolation: Users can only view trips they own or that have been explicitly shared with them.
- Protection of credentials: Passwords hashed with bcrypt cost 12. Password hashes and tokens are strictly excluded from audit logs and API responses.
- Prevention of existence disclosure: Attempts by unauthorized users to probe trip endpoints return HTTP 404 rather than 403.

### Integrity (I)
- Server-side role enforcement: Write operations (create/update/delete) are restricted to `OWNER` and `EDITOR` roles.
- Prevention of privilege escalation: Collaborators cannot elevate their own permissions, and the last `OWNER` of a trip cannot be removed.
- CSRF validation ensures that state-changing requests originate from authenticated user intent.

### Availability (A)
- Tiered rate-limiting: Global rate limit of 100 requests / 15 min; authentication rate limit of 10 requests / 15 min.
- Account lockout mitigates brute-force credential stuffing.
- Payload size restrictions (`50kb`) defend against memory exhaustion and denial-of-service vectors.
