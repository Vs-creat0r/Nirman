# Nirman ERP — Production Setup, Environment Separation & Runbook

> **Stage 5.5 Production Readiness Guide**  
> Document Version: 1.0  
> Date: 2026-09-05  

---

## 1. Overview & Architecture

Nirman ERP operates across a separated multi-tier deployment architecture:
- **Development**: Local Next.js dev server connected to a developer-isolated Convex instance (`dev:...`).
- **Preview**: Pull Request staging builds connected to dedicated preview deployments.
- **Production**: Vercel-hosted Next.js frontend connected to a dedicated production Convex deployment (`prod:...`).

```
  [ Developer / GitHub ]
            │
            ▼ (Push to main / Release Tag)
   [ Vercel Production Build ]
            │  1. Injects CONVEX_DEPLOY_KEY
            │  2. Runs: npx convex deploy --cmd 'npm run build'
            ├──▶ [ Convex Production Backend ] (Schema, Functions, Crons)
            └──▶ [ Vercel Production Edge / CDN ] (Next.js App)
```

---

## 2. Part A: Manual Cloud Infrastructure Checklist (Human-Only)

> [!IMPORTANT]
> The following steps require direct access to your cloud vendor dashboards (Convex, Vercel, GitHub). Execute each step manually before triggering production release.

### Step 1: Convex Production Deployment
1. Log in to [Convex Dashboard](https://dashboard.convex.dev).
2. Select your project `nirman`.
3. In the deployment dropdown, ensure the **Production** deployment exists.
4. Navigate to **Settings** $\rightarrow$ **Deployment Keys**.
5. Click **Generate Deploy Key** for the Production environment.
6. Copy the generated key (format: `prod:nirman-...|...`). Store securely.
7. Under **Settings** $\rightarrow$ **Environment Variables**, verify/configure:
   - `CONVEX_SITE_URL`: `https://<prod-deployment>.convex.site`

### Step 2: Vercel Project Configuration
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Create or open the `nirman` project connected to the GitHub repository `Vs-creat0r/Nirman`.
3. Navigate to **Settings** $\rightarrow$ **Environment Variables**:
   - `NEXT_PUBLIC_CONVEX_URL`: Set to your production Convex URL (`https://<prod-deployment>.convex.cloud`) for **Production** environment.
   - `NEXT_PUBLIC_CONVEX_SITE_URL`: Set to your production site URL for **Production** environment.
   - `CONVEX_DEPLOY_KEY`: Add as a **Secret** (Production environment only, check "Sensitive Environment Variable").
4. Navigate to **Settings** $\rightarrow$ **Build & Development Settings**:
   - **Build Command**: Set to `npx convex deploy --cmd 'npm run build'` (or leave as default if using `package.json` build script).
   - **Output Directory**: `.next` (Next.js default).
   - **Install Command**: `npm ci` (or `npm install`).

### Step 3: GitHub Branch Protection
1. In the GitHub repository settings (`Vs-creat0r/Nirman`), go to **Branches** $\rightarrow$ **Branch protection rules**.
2. Add a rule for `main`:
   - [x] Require a pull request before merging.
   - [x] Require status checks to pass before merging:
     - `Contract codegen is in sync`
     - `Lint`
     - `Metric ratchet`
     - `Gate 3 parity & invariants`
     - `Path-1 E2E regression`
     - `Typecheck`
     - `Tests`
   - [x] Do not allow bypassing the above settings.

---

## 3. Environment Variable Matrix

| Variable Name | Environment | Exposed to Client? | Description / Example |
|---|---|---|---|
| `CONVEX_DEPLOYMENT` | Dev | No | Local deployment identifier (`dev:project-name`) |
| `NEXT_PUBLIC_CONVEX_URL` | Dev / Preview / Prod | **Yes** | Primary Convex API endpoint (`https://<deploy>.convex.cloud`) |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Dev / Preview / Prod | **Yes** | Public HTTP actions endpoint (`https://<deploy>.convex.site`) |
| `CONVEX_SITE_URL` | Dev / Preview / Prod | No | Server-side auth / webhook domain |
| `CONVEX_DEPLOY_KEY` | CI / Prod Vercel | No (Secret) | Production deployment key for `npx convex deploy` |

---

## 4. Auth Security Architecture

Authentication in Nirman ERP enforces strict cryptographic security and session hygiene:

1. **Deterministic Sandbox Isolation**:
   - Convex queries and mutations run in a deterministic sandbox with seeded randomness.
   - `login` is implemented as a **Convex Action** (`convex/auth.ts`) which has access to true CSPRNG output.
2. **High-Entropy Session Tokens**:
   - Tokens are 256-bit cryptographically secure strings (`sess_` prefix followed by 64 hex characters generated via `crypto.getRandomValues`).
   - Stored in the `sessions` table with an expiration timestamp (`expiresAt`, default 30 days).
3. **Password Hashing & Lazy Migration**:
   - Password hashes are stored using standard PBKDF2 (`pbkdf2:100000:<saltHex>:<hashHex>`) with 100,000 iterations of SHA-256 and a 16-byte random salt.
   - Legacy plaintext credentials are automatically and lazily upgraded to PBKDF2 hashes upon first successful login.
   - All string comparisons use timing-safe constant-time equality (`timingSafeEqual`) to prevent side-channel timing attacks.
   - The insecure backdoor (`+123`) is completely removed.
4. **Session Resolution & RBAC**:
   - All protected backend operations pass the session token to `resolveCallerScope(ctx, args.token)` which validates token validity, user activation state, and project/site authorization scopes.

---

## 5. Deployment & Rollback Runbook

### Standard Production Deployment Flow
1. **Develop on Branch**: Implement feature on branch `feat/...`.
2. **Run Local Pre-flight Verification**:
   ```bash
   npm run gen:check
   npm run lint
   npm run check:metrics
   npm run check:gate3
   node scripts/gate3-path1-e2e.mjs
   npx tsc --noEmit
   npm test
   npm run build
   ```
3. **Open Pull Request**: Push branch and open PR against `main`. Verify all GitHub Actions CI checks pass green.
4. **Merge to `main`**: Merge PR (Squash or Merge Commit).
5. **Tag Release**: Create and push annotated tag (e.g., `git tag -a v1.7.0 -m "Release v1.7.0" && git push origin v1.7.0`).
6. **Vercel Deployment**: Vercel triggers automated build running `npx convex deploy --cmd 'npm run build'`.

### Emergency Rollback Procedures

#### Scenario 1: Frontend UI Regression (Convex Schema Intact)
- Go to [Vercel Dashboard](https://vercel.com) $\rightarrow$ **Deployments**.
- Find the last known healthy deployment.
- Click **Instant Rollback**. Traffic is immediately routed to the previous build without rebuilding.

#### Scenario 2: Backend Function / Logic Bug
- Checkout the last healthy release tag locally:
  ```bash
  git checkout tags/v1.7.0
  ```
- Deploy the previous healthy Convex functions using the deployment key:
  ```bash
  CONVEX_DEPLOY_KEY="prod:nirman-...|..." npx convex deploy
  ```
- Revert or rollback the Vercel deployment to match.

#### Scenario 3: Database / Data Inconsistency
- Access the [Convex Dashboard](https://dashboard.convex.dev) $\rightarrow$ **Production** $\rightarrow$ **Backups / Snapshots**.
- Restore to point-in-time snapshot prior to incident.
- Note: Material requests, stock movements, and financial commitments follow append-only ledger patterns and should be repaired via reversal movements where applicable.
