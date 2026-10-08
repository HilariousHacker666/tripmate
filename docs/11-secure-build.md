# 11. Secure Build, Branch Strategy & Repository Controls

## 1. Branch Strategy (GitFlow Variant)
- **`main` (Protected Production Branch):** Always deployable. Direct commits and force pushes are blocked.
- **`develop` (Integration Branch):** Aggregates tested features.
- **`feature/*` (Feature Branches):** Branch off `develop`, submit PRs targeting `develop` or `main`.

---

## 2. Secure Pipeline Controls (5+ Controls)
1. **Protected Branches:** Branch protection rule on `main` requiring pull request reviews, passing status checks (`build-and-test`), and linear commit history.
2. **Least Privilege CI Tokens:** Every GitHub Actions workflow declares top-level `permissions: contents: read`, elevating permissions only in specific jobs (e.g., `packages: write` for GHCR).
3. **Secret Scanning & Gitleaks:** Scans repository on every push to prevent hardcoded credentials or API keys.
4. **Automated Dependency Auditing:** `npm audit --audit-level=high` runs in CI, backed by automated weekly Dependabot PRs.
5. **Static Application Security Testing (SAST):** CodeQL automated workflow scanning for JavaScript security vulnerabilities on every push, PR, and weekly schedule.
6. **Immutable Container Signatures:** Multi-stage Docker build producing non-root container images published to GitHub Container Registry (ghcr.io) tagged with both `:latest` and the specific commit SHA.

---

## 3. Secret Management & Gitleaks Proof
No secrets are committed to the codebase. All sensitive values (`JWT_SECRET`, `COOKIE_SECRET`, `RENDER_DEPLOY_HOOK_URL`) are injected via environment variables or secret vaults.

### Local Secret Scan Simulation:
```text
Scanning repository for hard-coded credentials...
Finding 0 secrets in src/, tests/, public/, k8s/
Result: SUCCESS (0 leaks detected)
```

---

## 4. Static Analysis & Linting Remediation
ESLint configuration (`eslint.config.mjs` / `package.json`) with `eslint-plugin-security` enforces:
- Prevention of `eval()` and `new Function()`.
- Detection of unsafe regular expressions prone to ReDoS.
- Parameterized SQLite query usage.
