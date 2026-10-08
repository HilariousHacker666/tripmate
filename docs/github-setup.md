# GitHub & Render Deployment Setup Guide (Exam Lab Manual)

This guide documents the exact commands and step-by-step UI actions required to configure repository security, GitHub Actions CI/CD, GHCR container publishing, GitHub Pages documentation, and live deployment on Render.com.

---

## 1. Local Git Initialization & Remote Push
Open your terminal in the `sse_end` directory and execute:
```bash
# 1. Initialize local Git repository
git init

# 2. Rename initial branch to main
git branch -M main

# 3. Stage all files (verifying .gitignore excludes .env, node_modules, and *.db)
git add .

# 4. Commit baseline
git commit -m "feat: complete TripMate secure application implementation (24CYS401)"

# 5. Add your GitHub remote repository (replace with your personal GitHub URL)
git remote add origin https://github.com/<your-username>/tripmate.git

# 6. Push to GitHub
git push -u origin main

# 7. Create and push the develop integration branch
git checkout -b develop
git push -u origin develop
git checkout main
```

---

## 2. GitHub Repository Settings & Branch Protection
Navigate to **GitHub Repository Settings**:

### A. Branch Protection Rules (`Settings > Branches`)
Click **Add branch protection rule**:
- **Branch name pattern:** `main`
- [x] **Require a pull request before merging** (Require 1 approval)
- [x] **Require status checks to pass before merging** (Search and select: `build-and-test`)
- [x] **Require branches to be up to date before merging**
- [x] **Require linear history**
- [x] **Do not allow bypassing the above settings**
- Click **Create / Save Changes**.

### B. Security & Code Analysis Settings (`Settings > Code security and analysis`)
- [x] **Dependency graph:** Enabled
- [x] **Dependabot alerts:** Enabled
- [x] **Dependabot security updates:** Enabled
- [x] **Secret scanning:** Enabled
- [x] **Push protection:** Enabled

### C. Actions Secrets (`Settings > Secrets and variables > Actions`)
Add the following **Repository Secrets**:
1. `JWT_SECRET`: Generate a random 64-character hex string (e.g., `openssl rand -hex 32`)
2. `RENDER_DEPLOY_HOOK_URL`: Paste the Webhook URL copied from your Render service settings.

---

## 3. GitHub Pages Documentation Deployment
1. Go to **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. The `.github/workflows/pages.yml` workflow will automatically build and publish `/docs` to:
   `https://<your-username>.github.io/tripmate/`

---

## 4. Live Deployment on Render.com
1. Log in to [Render.com](https://render.com).
2. Click **New + > Web Service**.
3. Connect your GitHub repository `tripmate`.
4. Render detects `render.yaml` (Blueprint) or manual settings:
   - **Environment:** Docker
   - **Branch:** `main`
   - **Plan:** Free
   - **Health Check Path:** `/health`
5. Under **Environment Variables**, ensure:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: (Set automatically or paste 32+ char secret)
6. Copy the **Deploy Hook URL** from Settings and add it as the `RENDER_DEPLOY_HOOK_URL` secret on GitHub.
