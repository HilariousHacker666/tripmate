# 08. Attack Tree & Security-Refined Architecture

## 1. Attack Tree Diagram

Root Goal: **"Access or modify a trip I am not authorized for"**

```mermaid
graph TD
  Root["Root Goal: Access or Modify Unauthorized Trip"]

  Root --> OR1{"OR: Bypass Authentication"}
  Root --> OR2{"OR: Exploit Authorization (IDOR / BOLA)"}
  Root --> OR3{"OR: Elevate Privileges within Trip"}
  Root --> OR4{"OR: Execute Code / SQL Injection"}

  %% Path 1: Auth Bypass
  OR1 --> A1["Brute Force Login Password"]
  A1 -->|Prevented By| C1["Account Lockout (5 attempts) & Rate Limiting"]
  OR1 --> A2["Forge JWT Session Token"]
  A2 -->|Prevented By| C2["HMAC-SHA256 signature with 32+ char secret"]
  OR1 --> A3["Steal JWT via Cross-Site Scripting"]
  A3 -->|Prevented By| C3["HttpOnly Cookie & Strict Content-Security-Policy"]

  %% Path 2: IDOR / BOLA
  OR2 --> B1["Enumerate Trip UUID in GET /api/trips/:id"]
  B1 -->|Prevented By| C4["requireTripRole returns 404 Not Found & UUID v4"]
  OR2 --> B2["Access Child Resources Directly (Expenses, Itinerary)"]
  B2 -->|Prevented By| C5["verifyExpenseBelongsToTrip cross-checks parent trip_id"]

  %% Path 3: Privilege Escalation
  OR3 --> D1["Viewer attempts POST to create expense"]
  D1 -->|Prevented By| C6["requireTripRole(['OWNER','EDITOR']) rejects with 403"]
  OR3 --> D2["Editor attempts to demote Trip Owner"]
  D2 -->|Prevented By| C7["Collaborator management requires OWNER role"]
  OR3 --> D3["Owner demotes self as last owner"]
  D3 -->|Prevented By| C8["Last OWNER validation rule prevents removal"]

  %% Path 4: Injection
  OR4 --> E1["SQL Injection in Expense Creation"]
  E1 -->|Prevented By| C9["Parameterized SQL prepared statements"]
  OR4 --> E2["CSRF Attack via external site"]
  E2 -->|Prevented By| C10["Double-submit CSRF cookie + header check"]
```

---

## 2. Preventive and Detective Controls

| Control Category | Control ID | Mechanism | Attack Vector Addressed |
|---|---|---|---|
| **Preventive** | **PC-01** | HttpOnly, SameSite=Strict session cookie | Cookie theft via XSS |
| **Preventive** | **PC-02** | Reusable `requireTripRole` middleware | IDOR / Unauthorized modifications |
| **Preventive** | **PC-03** | Express-validator schemas & type validation | Malformed payloads, SQLi, XSS |
| **Preventive** | **PC-04** | Prepared statements with bound parameters | SQL injection (CWE-89) |
| **Preventive** | **PC-05** | Double-submit CSRF verification | Cross-Site Request Forgery (CWE-352) |
| **Detective** | **DC-01** | Structured JSON security logging (`auditService`) | Identification of abnormal access patterns |
| **Detective** | **DC-02** | Automated negative integration tests (`security.test.js`)| Verification of defensive controls |
| **Detective** | **DC-03** | Fuzzing harness (`tests/fuzz/fuzz.js`) | Detection of unhandled parser exceptions |
