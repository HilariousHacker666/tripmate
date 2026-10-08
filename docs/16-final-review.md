# 16. Final Security Review & Traceability Chain

## 1. Complete Traceability Chain
**Security Requirement (SR-02 / SR-03):** *"Only authorized collaborators with the right role can access or modify a trip, child resources, or permissions."*

```mermaid
flowchart TD
  R["1. Security Requirement: SR-02 & SR-03 (Strict RBAC & BOLA Prevention)"]
  --> UC["2. Use Cases: UC-07 (Edit Shared Expense) & UC-08 (Share Trip)"]
  --> DFD["3. DFD: Level-1 DFD (RBAC & IDOR Enforcement Gate)"]
  --> TM["4. Threat Model: Threat T-06 (BOLA Enumeration) & T-10 (Privilege Escalation)"]
  --> V["5. Vulnerability Catalog: V-02 (Broken Object-Level Authorization - CWE-639)"]
  --> AT["6. Attack Tree: Node OR2 (Exploit Authorization) & Node OR3 (Elevate Privileges)"]
  --> US["7. User Story: US-08, US-09, US-10, US-11"]
  --> ST["8. Sprint Task: TASK-105 & TASK-203"]
  --> IMP["9. Implementation: src/middleware/rbac.js -> requireTripRole() & verifyExpenseBelongsToTrip()"]
  --> TEST["10. Test Suites: tests/unit/rbac.test.js & tests/integration/security.test.js (SEC-01, SEC-02)"]
  --> DEP["11. Deployment Controls: GitHub Actions CI (npm test) & K8s NetworkPolicy"]
```

---

## 2. Top 3 Residual Risks & Controls

| Risk Rank | Residual Risk Description | Inherent Risk | Implemented Controls & Residual Risk Level |
|---|---|---|---|
| **Risk 1** | **Database Storage File Compromise on Host:** If an attacker gains full root shell on the underlying host, the unencrypted SQLite file could be read directly. | High | **Low (Residual):** Container runs as unprivileged `appuser` (UID 10001), `allowPrivilegeEscalation: false`, read-only root system, capabilities dropped, K8s secrets isolation. |
| **Risk 2** | **Compromised User Credentials via Phishing:** Legitimate credentials phished from a user allowing authorized session establishment. | High | **Medium (Residual):** Account lockout on 5 failed attempts, 15-minute short JWT expiry, full audit logging of IP/User-Agent, and role segregation limiting damage. |
| **Risk 3** | **DoS via Complex Network Flooding:** Volumetric network layer DDoS exceeding ingress capacity. | Medium | **Low (Residual):** Two-tier application rate limiting (global + auth), 50kb request payload cap, and upstream reverse proxy / cloud WAF mitigation. |

---

## 3. Project Limitations
1. **Single-Node SQLite Concurrency:** SQLite in WAL mode handles concurrent reads efficiently, but write locks serialize simultaneous high-frequency transactions across hundreds of parallel requests. (Suitable for offline lab exam; for hyperscale, migrate database adapter to PostgreSQL).
2. **Ephemeral Disk on Free Hosting:** On Render free web service tier without persistent disk attachments, the SQLite database resets when the container goes to sleep or restarts. (Mitigated by automated database seeder and Docker mount volume in Kubernetes).
