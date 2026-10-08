# TripMate — Collaborative Travel Planning Web Application
[![CI Pipeline](https://github.com/monis/tripmate/actions/workflows/ci.yml/badge.svg)](https://github.com/monis/tripmate/actions/workflows/ci.yml)
[![CodeQL Analysis](https://github.com/monis/tripmate/actions/workflows/codeql.yml/badge.svg)](https://github.com/monis/tripmate/actions/workflows/codeql.yml)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue.svg)](https://github.com/monis/tripmate/pkgs/container/tripmate)
[![Live Demo](https://img.shields.io/badge/demo-Render-black.svg)](https://tripmate.onrender.com)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-black.svg)](https://monis.github.io/tripmate/)

> **Course:** 24CYS401 Secure Software Engineering Lab Exam  
> **Aesthetic:** Strict Black & White Minimalist Design (No colored accents)

---

## 1. Quick Overview & Security Highlights
TripMate is a secure, collaborative travel-planning platform designed for privacy, defense-in-depth, and traceability:
- **Authentication:** Salted bcrypt password hashing (cost 12), short-lived JWT (15 min) in an HttpOnly, SameSite=Strict, Secure cookie.
- **Account Lockout:** Locks user out after 5 consecutive failed login attempts for 15 minutes.
- **Access Control & IDOR/BOLA Protection:** Server-side `requireTripRole` middleware; inaccessible or non-existent trips return **HTTP 404** (not 403) to prevent resource enumeration.
- **Privilege Escalation Defense:** Collaborators cannot elevate their own role; the last OWNER of a trip cannot be removed or demoted.
- **Injection Defense:** 100% Parameterized SQL queries using `better-sqlite3` prepared statements.
- **State Mutation Defense:** Double-submit CSRF cookie (`XSRF-TOKEN`) verified against headers on all mutating verbs.
- **Fuzzing & Hardening:** Verified against 33 malicious payloads (buffer overflows, null bytes, type confusion, malformed JSON).

---

## 2. Demo Credentials
The repository includes an automated seeder creating 3 demo users and a shared trip:
- **Password (for all demo accounts):** `StrongPassword123!`
- **Demo Accounts:**
  1. **OWNER:** `owner@tripmate.local` (Full administration, share/revoke, delete, trip audit logs)
  2. **EDITOR:** `editor@tripmate.local` (Can add/edit destinations, itinerary, expenses)
  3. **VIEWER:** `viewer@tripmate.local` (Read-only access)

---

## 3. How to Run Locally

### Prerequisites
- Node.js 20+ installed
- Git installed

### Steps
```bash
# 1. Install dependencies
npm install

# 2. Seed demo database
npm run seed

# 3. Start local development server
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 4. How to Run Tests & Security Fuzzing

```bash
# Run all tests (Unit, Integration, E2E, Negative Security)
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (Collaboration lifecycle & role progression)
npm run test:integration

# Run negative security tests (IDOR, SQLi, XSS, CSRF, Token forgery)
npm run test:security

# Run end-to-end tests
npm run test:e2e

# Run security fuzzing harness (generates tests/fuzz/FUZZ_REPORT.md)
npm run fuzz
```

---

## 5. Deployment Options

### A. Run with Docker
```bash
# Pull image from GitHub Container Registry
docker pull ghcr.io/<your-username>/tripmate:latest

# Or build locally:
docker build -t tripmate .

# Run container as non-root user:
docker run -p 3000:3000 --env-file .env tripmate
```

### B. Deploy on Kubernetes (Minikube)
```bash
# 1. Start Minikube
minikube start

# 2. Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.example.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/networkpolicy.yaml

# 3. Access the service
minikube service tripmate-service -n tripmate
```

### C. Live Cloud Deployment (Render.com)
- TripMate includes a `render.yaml` Blueprint.
- Simply connect your GitHub repository to Render as a Web Service.
- Set `JWT_SECRET` and `NODE_ENV=production`.
- Live health check available at `/health`.

---

## 6. Exam Screenshot Checklist (Capture for Lab Evidence)

| # | Item to Capture | How to Display |
|---|---|---|
| **1** | **Passing Test Suite** | Terminal showing `npm test` passing with 26/26 tests across 5 suites. |
| **2** | **Fuzzing Harness Execution** | Terminal running `npm run fuzz` and `tests/fuzz/FUZZ_REPORT.md` (33/33 handled, 0 crashes). |
| **3** | **Black & White UI Dashboard** | Browser at `/` showing Trip cards with OWNER, EDITOR, VIEWER badges. |
| **4** | **B/W SVG Expense Bar Chart** | Trip Detail > Expenses tab showing pure SVG category spending bars. |
| **5** | **Share Modal & Role Management** | Owner opening Collaborators modal with role dropdowns and revoke actions. |
| **6** | **Defect Report & Retest** | `docs/defect-report.md` documenting DEF-01 SQLite `'now'` syntax fix. |
| **7** | **GitHub Actions Green CI** | GitHub Actions tab showing green check on `ci.yml` pipeline. |
| **8** | **Branch Protection Rules** | GitHub Repo `Settings > Branches` showing protected `main` branch. |
| **9** | **GitHub Pages Documentation** | Browser viewing the published `docs/index.html` portal. |
| **10**| **Docker / Minikube Pods** | Terminal output of `kubectl get pods -n tripmate`. |
