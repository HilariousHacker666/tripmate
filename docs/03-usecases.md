# 03. Use Case Specifications & Collaboration Analysis

## 1. Mermaid Use Case Diagram

```mermaid
flowchart TD
  User((Registered User))
  Owner((Trip Owner))
  Editor((Trip Editor))
  Viewer((Trip Viewer))

  User --> UC1[UC-01: Register & Authenticate]
  User --> UC2[UC-02: Create New Trip]

  Owner -- inherits --> Editor
  Editor -- inherits --> Viewer

  Viewer --> UC3[UC-03: View Trip Overview & Itinerary]
  Viewer --> UC4[UC-04: View Expenses & Category Chart]

  Editor --> UC5[UC-05: Add / Remove Destination]
  Editor --> UC6[UC-06: Create / Update Itinerary Activity]
  Editor --> UC7[UC-07: Record / Delete Expense]

  Owner --> UC8[UC-08: Share Trip with Collaborator]
  Owner --> UC9[UC-09: Modify Collaborator Role / Revoke Access]
  Owner --> UC10[UC-10: Delete Trip]
  Owner --> UC11[UC-11: Inspect Trip Audit Trail]

  UC8 -.->|<<include>>| UC12[SR-02: Validate Owner Role Middleware]
  UC7 -.->|<<include>>| UC13[SR-03: Validate Parent Trip Ownership / IDOR Check]
  UC8 -.->|<<include>>| UC14[SR-07: Record Security Audit Log]
```

---

## 2. Detailed Use Case Specifications

### Use Case UC-08: Share Trip with Permission
- **Primary Actor:** Trip OWNER
- **Preconditions:** The actor is authenticated; a trip exists where the actor has role `OWNER`.
- **Trigger:** Owner enters collaborator email, selects role (`OWNER`, `EDITOR`, or `VIEWER`), and submits the share modal.
- **Main Success Scenario:**
  1. The actor sends `POST /api/trips/:tripId/collaborators` with email and role.
  2. The server verifies the CSRF token and validates the actor's session JWT.
  3. The `requireTripRole(['OWNER'])` middleware verifies the actor is an owner of `:tripId`.
  4. The server queries `Users` table by email to find the recipient account.
  5. The server confirms the recipient is not already a collaborator on this trip.
  6. The server inserts a record into `TripMembers` with the specified role.
  7. The server calls `logAudit()` to record the `COLLABORATOR_SHARE` event with timestamp and IP.
  8. The server returns HTTP 201 Created with collaborator details.
- **Alternative / Exceptional Flows:**
  - *Recipient not registered:* Server returns 404 with error message: "User with this email not found."
  - *Recipient already added:* Server returns 409 Conflict.
  - *Caller is EDITOR or VIEWER:* Server returns 403 Forbidden.
  - *Caller has no access to trip:* Server returns 404 Not Found (BOLA prevention).

### Use Case UC-07: Edit Shared Expense
- **Primary Actor:** Trip OWNER or EDITOR
- **Preconditions:** Actor is authenticated; trip exists; actor has role `OWNER` or `EDITOR`.
- **Main Success Scenario:**
  1. Actor submits new expense (amount, currency, category, description, paid_by, date).
  2. Server verifies CSRF token.
  3. `requireTripRole(['OWNER', 'EDITOR'])` validates permissions.
  4. Validation schema checks that `amount > 0` and category is valid enum.
  5. Database executes parameterized `INSERT INTO Expenses`.
  6. Server records `EXPENSE_CREATE` in `AuditLogs`.
  7. Server returns HTTP 201 Created.
- **Alternative Flows:**
  - *Caller has VIEWER role:* Server rejects request with HTTP 403 Forbidden.
  - *Amount is negative or zero:* Server validation returns HTTP 400 Bad Request.

---

## 3. Scenario-Based Analysis Model: "Share Trip and Collaborate"

```mermaid
sequenceDiagram
  autonumber
  actor Alice as Alice (Owner)
  actor Charlie as Charlie (Collaborator)
  participant App as TripMate Web App
  participant Server as Express API Server
  participant DB as SQLite DB

  Alice->>App: Submits share form (Charlie's email, Role=VIEWER)
  App->>Server: POST /api/trips/:tripId/collaborators (with CSRF + JWT)
  Server->>DB: Query TripMembers where user_id=Alice AND trip_id=:tripId
  DB-->>Server: Return role='OWNER'
  Server->>DB: Lookup user Charlie by email
  DB-->>Server: Return Charlie user record
  Server->>DB: INSERT into TripMembers (trip_id, user_id, role='VIEWER')
  Server->>DB: INSERT into AuditLogs (action='COLLABORATOR_SHARE')
  Server-->>App: HTTP 201 Created
  App-->>Alice: Displays updated collaborator list

  Charlie->>App: Logs in & views dashboard
  App->>Server: GET /api/trips
  Server->>DB: SELECT trips JOIN TripMembers WHERE user_id=Charlie
  DB-->>Server: Returns Alice's trip with role='VIEWER'
  Server-->>App: 200 OK (Trip rendered with VIEWER dashed badge)
  
  Note over Charlie,Server: Charlie tries to add an expense
  Charlie->>App: Submits expense
  App->>Server: POST /api/trips/:tripId/expenses
  Server->>DB: Check membership for Charlie
  DB-->>Server: role='VIEWER'
  Server-->>App: HTTP 403 Forbidden (requireTripRole check fails)
  App-->>Charlie: Error notification: Read-only access
```
