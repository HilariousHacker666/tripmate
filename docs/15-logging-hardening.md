# 15. Logging, Hardening & Operational Controls

## 1. Security Events to Log
TripMate enforces structured JSON logging (`src/services/auditService.js` and `src/utils/logger.js`) capturing:
- `AUTH_REGISTER_SUCCESS` / `AUTH_REGISTER_FAIL_EXISTS`
- `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAIL_BAD_PASSWORD` / `AUTH_LOGIN_LOCKED`
- `AUTH_ACCOUNT_LOCKOUT_TRIGGERED`
- `AUTH_LOGOUT`
- `COLLABORATOR_SHARE` / `COLLABORATOR_ROLE_CHANGE` / `COLLABORATOR_REVOKE`
- `TRIP_CREATE` / `TRIP_UPDATE` / `TRIP_DELETE`
- `EXPENSE_CREATE` / `EXPENSE_DELETE`
- `ACCESS_DENIED_NOT_FOUND` (IDOR probe) / `ACCESS_DENIED_FORBIDDEN` (Insufficient role)

---

## 2. Security Metrics and Alerting Thresholds

| Metric | Threshold | Alert Severity | Operational Response |
|---|---|---|---|
| **Failed Logins Spike** | > 10 failures / IP / min | **High** | Temporarily block IP via Cloudflare / WAF; investigate credential stuffing. |
| **HTTP 403 Spike** | > 15 events / 5 min | **Medium** | Investigate compromised account or horizontal privilege escalation attempt. |
| **HTTP 404 on Protected Routes** | > 20 events / 5 min | **High** | Alert on potential BOLA/IDOR enumeration scanning; inspect actor user ID. |
| **Rate Limit Violations (429)** | > 50 hits / min | **Medium** | Verify API client behavior; engage bot mitigation. |
| **5xx Server Error Rate** | > 1% total traffic | **Critical** | Alert on-call engineer; review Winston `error.log` for unhandled exceptions. |

---

## 3. Container & Operating System Hardening Checklist
- [x] **Non-Root Execution:** Container runs as non-root user `appuser` (UID 10001).
- [x] **Dropped Capabilities:** Kubernetes manifest specifies `drop: ["ALL"]` capabilities.
- [x] **Privilege Escalation Blocked:** Kubernetes pod specifies `allowPrivilegeEscalation: false`.
- [x] **Port Minimization:** Only single unprivileged HTTP port (3000) exposed.
- [x] **Minimal Base Image:** Built on `node:20-alpine` stripped of package managers and extraneous build utilities.
- [x] **Signal Forwarding & PID 1:** Wrapped with `dumb-init` to handle zombie processes and graceful `SIGTERM` signals.
- [x] **Secrets Isolation:** No secrets baked into images; injected dynamically via Kubernetes `Secret` or Render environment secrets.
- [x] **Security Headers:** Strict Content Security Policy, HSTS enabled, X-Frame-Options set to DENY via Helmet.
