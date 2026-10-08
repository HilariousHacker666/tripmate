# 07. Threat Model (STRIDE Methodology)

## 1. Asset Inventory & CIA Classification

| Asset ID | Asset Name | Description | CIA Impact |
|---|---|---|---|
| **A-01** | User Password Hashes | Salted bcrypt hashes in `Users` table | **C: Critical, I: High, A: Low** |
| **A-02** | JWT Signing Secret | Secret key used to sign session cookies | **C: Critical, I: Critical, A: High** |
| **A-03** | Trip Financial Records | Budget, individual expenses, currencies | **C: High, I: Critical, A: Medium** |
| **A-04** | User Itineraries & Dates | Physical locations, hotels, timestamps | **C: High, I: High, A: Medium** |
| **A-05** | Collaborator Permission Matrix | `TripMembers` role bindings | **C: Medium, I: Critical, A: High** |
| **A-06** | Security Audit Trail | Immutable event logs in `AuditLogs` | **C: High, I: Critical, A: High** |
| **A-07** | CSRF Tokens | Cryptographic double-submit tokens | **C: High, I: High, A: Low** |
| **A-08** | Database Storage File | `tripmate.db` SQLite database on disk | **C: Critical, I: Critical, A: Critical** |

---

## 2. STRIDE Threat Analysis Table (10+ Threats)

| Threat ID | STRIDE Category | Affected Element | Threat Description | Potential Impact | Implemented Mitigation |
|---|---|---|---|---|---|
| **T-01** | **Spoofing** | Auth Controller | Attacker submits forged or expired JWT token | Impersonation of legitimate user | `jwt.verify` with short expiry (15m), signature validation, and secret key length check |
| **T-02** | **Spoofing** | API Endpoints | Cross-Site Request Forgery (CSRF) from malicious website | Unintended trip/expense modification | Double-submit CSRF cookie token with `SameSite=Strict` and `x-csrf-token` header check |
| **T-03** | **Tampering** | Expense Route | Parameter tampering: negative amounts or altered trip IDs | Financial calculation disruption | `express-validator` schema checking `amount > 0` and UUID format |
| **T-04** | **Tampering** | Database Layer | SQL Injection via raw string concatenation in queries | Arbitrary database corruption or exfiltration | Parameterized queries with prepared statements via `better-sqlite3` |
| **T-05** | **Repudiation** | Collaborator Route | User revokes member or modifies role and denies doing so | Lack of accountability | Audit logging in `AuditLogs` and Winston with IP, user ID, and timestamp |
| **T-06** | **Information Disclosure** | Trip Route | IDOR / BOLA: User enumerates private trip IDs | Leakage of private travel schedules | Server-side `requireTripRole` middleware returning HTTP 404 instead of 403 |
| **T-07** | **Information Disclosure** | Error Handler | Unhandled exception reveals database schema or stack trace | Information disclosure (CWE-209) | Centralized error handler returning generic user messages and logging internally |
| **T-08** | **Denial of Service** | Login Route | Credential brute-forcing via automated bot dictionary attacks | Server resource exhaustion, account takeover | Rate limiting (10 req/15 min) and account lockout after 5 consecutive failures |
| **T-09** | **Denial of Service** | JSON Body Parser | Giant payload submission causing buffer overflow or OOM | Application denial of service | Body parser limit set to strict `50kb` |
| **T-10** | **Elevation of Privilege** | Member Role Route | VIEWER or EDITOR modifies role or revokes trip owner | Unauthorized administrative takeover | Server-side role check requiring `OWNER` role, plus rule preventing last OWNER removal |
| **T-11** | **Tampering / XSS** | Presentation Layer | Attacker injects `<script>` tags into trip titles or notes | Stored Cross-Site Scripting (XSS) | `express-validator` HTML entity escaping and strict CSP via Helmet |

---

## 3. Information-Flow Analysis for Sensitive Assets

```mermaid
flowchart TD
  subgraph Asset1 ["Asset 1: User Password"]
    P1["Client Input (Plaintext)"] -->|HTTPS / TLS| P2["Express Validation"]
    P2 -->|bcrypt.hash (Cost >= 12)| P3["Users.password_hash (DB)"]
    P3 -.->|NEVER exposed in API / logs| P4["[Redacted / Excluded]"]
  end

  subgraph Asset2 ["Asset 2: JWT Session Token"]
    J1["Generated on Successful Login"] -->|Sign with JWT_SECRET| J2["Set-Cookie Header"]
    J2 -->|HttpOnly + SameSite=Strict| J3["Browser Cookie Jar"]
    J3 -->|Auto-attached on safe requests| J4["requireAuth Middleware"]
  end

  subgraph Asset3 ["Asset 3: Financial & Trip Data"]
    D1["Client Expense Payload"] -->|CSRF + JWT| D2["requireTripRole Verification"]
    D2 -->|Parameterized Prepared Statement| D3["Expenses Table (DB)"]
    D3 -->|Filtered by User Membership| D4["Authorized Client Only"]
  end
```

---

## 4. Vulnerability Catalog & Mitigations

| Vuln ID | Vulnerability Name | Related Threat | Impact | Technical Mitigation |
|---|---|---|---|---|
| **V-01** | SQL Injection (CWE-89) | T-04 | Critical | Parameterized queries with prepared statements via `better-sqlite3` |
| **V-02** | Broken Object-Level Authorization (CWE-639) | T-06 | High | `requireTripRole` middleware returning 404 for inaccessible resources |
| **V-03** | Cross-Site Request Forgery (CWE-352) | T-02 | High | Double-Submit CSRF cookie validation on all mutating verbs |
| **V-04** | Stored Cross-Site Scripting (CWE-79) | T-11 | Medium | `express-validator` `.escape()` and Helmet Content Security Policy |
| **V-05** | Credential Stuffing / Brute-Force (CWE-307) | T-08 | High | Account lockout after 5 failed attempts + auth rate limiter |
| **V-06** | Information Leakage in Errors (CWE-209) | T-07 | Medium | Centralized error handler suppressing stack traces in responses |
