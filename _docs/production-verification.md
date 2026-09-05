# Nirman — Production Verification Record

- **Date:** [YYYY-MM-DD]
- **Target Git SHA:** [commit hash]
- **Target Tag:** v1.8.0
- **Live URL:** [https://your-production-app.vercel.app]
- **Convex Production Deployment:** [https://your-deployment.convex.cloud]
- **Verifier:** [Your Name / Role]

---

## Part A — Environment & Deployment Prerequisites

| Item | Requirement | Status | Notes |
|---|---|---|---|
| A1 | Convex Production Deployment provisioned | [ ] | |
| A2 | `CONVEX_DEPLOY_KEY` configured in Vercel Production environment | [ ] | |
| A3 | Vercel Build Command set to `npx convex deploy --cmd 'npm run build'` | [ ] | |
| A4 | `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL` set in Vercel Production | [ ] | |
| A5 | GitHub `main` branch protection enabled (Require status checks) | [ ] | |
| A6 | Production DB seeded (`npx convex run seed:seedAll --prod`) | [ ] | |

---

## Part C — Live Verification Results

### C1 — Auth & Password Hashing Verification
- **Method:** Primary (Convex Dashboard `users` table) / Secondary (`auth.hashAlgoForUser` query)
- [ ] Admin login successful via live UI
- [ ] Password hash format in Convex production `users` table starts with `pbkdf2:100000:`
- [ ] Backdoor password attempt (`password+"123"`) explicitly rejected
- **Observed Hash Format:** `[e.g., pbkdf2:100000:...]`
- **Result:** [PASS / FAIL]

### C2 — Core Procurement Routes Verification

#### 1. Path-0: Material Request Flow
- [ ] Creator role creates Material Request
- [ ] Approver role reviews and approves Material Request
- [ ] State transitions cleanly to `approved`
- **Document ID / Reference:** `[e.g., MR-2026-0001]`
- **Result:** [PASS / FAIL]

#### 2. Path-1: Cost Comparison -> PO Flow
- [ ] RFQ created with multiple items
- [ ] At least 2 distinct vendor quotes submitted
- [ ] Cost Comparison created and comparison matrix rendered
- [ ] Purchase Order created from approved Cost Comparison
- [ ] **Quote Snapshot Immutability:** Updating vendor quote does NOT alter approved PO / CC snapshot
- **Document IDs:** RFQ: `[...]`, CC: `[...]`, PO: `[...]`
- **Result:** [PASS / FAIL]

#### 3. Standalone RFQ Route
- [ ] Direct RFQ creation without prior MR
- [ ] Quote entry and vendor allocation complete
- **Document ID:** `[...]`
- **Result:** [PASS / FAIL]

### C3 — Vector PDF Generation & Document Integrity
- [ ] Purchase Order PDF downloaded from live site
- [ ] PDF renders crisp vector text (not a canvas/screenshot raster)
- [ ] Indian Rupee symbol (`₹`) renders cleanly without tofu/glyph errors
- [ ] Text in PDF is searchable and selectable (e.g., searching for "₹" or line item names succeeds)
- [ ] File size is lightweight (< 50 KB for standard single/dual page document)
- **Document Tested:** `[e.g., PO-2026-0001]`
- **File Size:** `[e.g., 29 KB]`
- **Result:** [PASS / FAIL]

---

## Sign-off & Tagging
- **Overall Status:** [PENDING / VERIFIED]
- **Tagged Release:** `v1.8.0`
- **Signed Off By:** [Name / Date]
