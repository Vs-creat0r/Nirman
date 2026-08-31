# Nirman ERP — Stage 1 Audit Closure & Verification Report

**Release Milestone:** `v1.3.0`  
**Stage:** Stage 1 — Foundation Hardening & Security Remediation  
**Status:** Completed & Verified  

---

## 1. Executive Summary

This document certifies the completion of **Stage 1** for Nirman ERP. All critical security vulnerabilities, broken state machine loops, IDOR privilege escalation flaws, and contract drift issues identified in the Initial Audit Report (`_docs/nirman-audit-report_1.md`) have been resolved and machine-verified against both local static suites and the live Convex cloud deployment.

All four mandatory verification gates are **100% green**:
- 🟢 **Gate 1 (RBAC & Segregation of Duties)**: Passed (311 static permissions tests, 0 `requireRole`, 0 `actorRole: [`).
- 🟢 **Gate 2 (IDOR & Row-Level Scoping Live Sweep)**: Passed (15/15 live assertions against backend).
- 🟢 **Gate 3 (BOQ Commitment Accounting Live Regression)**: Passed (6/6 live assertions, delta arithmetic verified).
- 🟢 **Gate 4 (Four-Role Lifecycle & Browser UI Scoping)**: Passed (29/29 live E2E assertions + 4-role interactive browser pass).

---

## 2. Audit Findings Resolution Matrix (H1 – H10)

| ID | Severity | Description | Final Status | Verification & Resolution Details |
|---|---|---|---|---|
| **H1** | 🔴 CRITICAL | Material Request Resubmission Infinite Loop | ✅ **Resolved** | `resubmitMR` enforces transition from `["queried"]` only. State cycles cleanly to `pending` without terminal traps. |
| **H2** | 🟠 HIGH | Cost Comparison Raisable Against Rejected MR | ✅ **Resolved** | `createCC` enforces `from: ["ready_for_cc", "draft"]`. Cannot quote on dead or unapproved MRs. |
| **H3** | 🟠 HIGH | CC Quantities Unchecked Against MR | 🔲 **Deferred** | *Target: Stage 2 (RFQ Expansion)*. Requires dynamic partial-quoting and sub-item splitting engine. |
| **H4** | 🟠 HIGH | Unlimited Duplicate POs from Single CC | ✅ **Resolved** | `purchase_orders.ts` verifies uniqueness of `costComparisonId` on creation and marks CC processed. |
| **H5** | 🟠 HIGH | 0% GST Tax Quote Defaults to 18% | ✅ **Resolved** | Replaced `0 \|\| 18` with nullish coalescing `?? 18` across 5 sites (PO creation, approval, PO edit modal, CC edit form). Automated tests in `tests/tax_and_quantity_validation.test.ts`. |
| **H6** | 🟠 HIGH | Negative Quote Quantities Rig Lowest Bid | ✅ **Resolved** | Server-side validation in `processVendorQuotes` enforces `qty > 0`, `rate >= 0`, `0 <= taxRate <= 100`, `freight >= 0`. Tested in `tests/tax_and_quantity_validation.test.ts`. |
| **H7** | 🔴 CRITICAL | Zero Row-Level Scoping / System-Wide IDOR | ✅ **Resolved** | Built `convex/scoping.ts` engine enforcing fail-closed boundaries for all 4 roles. 15/15 live IDOR sweep passed. |
| **H8** | 🔴 CRITICAL | UI-Only Role Gating / Backend Ungated | ✅ **Resolved** | Centralized `requirePermission()` in `convex/permissions.ts` on all 42 mutations and queries. |
| **H9** | 🟠 HIGH | Contract-First Architecture Broken & Schema Drift | ✅ **Resolved** | Re-aligned 16 JSON contracts with `schema.ts`. Automated CI check `npm run gen:check` enforced. |
| **H10** | 🟠 HIGH | Unbounded Collection Scans in Scoping & Logs | 🟡 **Improved** | Replaced collection scans with `queryScopedByIndex` executing compound index range queries per assigned site/project. `resolveCallerScope` uses index lookups. |

---

## 3. Four Mandatory Verification Gates

### Gate 1: RBAC & Segregation of Duties
- **Scope**: 311 automated tests in [`tests/permissions_matrix.test.ts`](file:///d:/NOTION/nirman/nirman/tests/permissions_matrix.test.ts).
- **Invariants Verified**:
  - Zero usages of deprecated `requireRole` across the codebase.
  - Zero hardcoded role array checks (`actorRole: [`) in business logic.
  - Granular segregation of duties: Procurement Officer cannot approve own PO/CC; Site Supervisor cannot read vendor quotes.

### Gate 2: IDOR & Row-Level Scoping Live Sweep
- **Scope**: 15 live database assertions across all 4 authenticated roles via [`scripts/gate2-live-sweep.mjs`](file:///d:/NOTION/nirman/nirman/scripts/gate2-live-sweep.mjs).
- **Invariants Verified**:
  - Non-assigned users receive `Forbidden` on direct document ID queries.
  - Site Supervisors cannot read or list documents outside their assigned `siteId`.
  - Project Managers cannot access projects outside their `assignedProjectIds`.

### Gate 3: BOQ Commitment Accounting Live Regression
- **Scope**: 6 live database assertions via [`scripts/gate3-live-regression.mjs`](file:///d:/NOTION/nirman/nirman/scripts/gate3-live-regression.mjs).
- **Invariants Verified**:
  - PO Approval reserves `committedQty` without prematurely modifying `procuredQty`.
  - GRN delivery confirmation atomically increments `procuredQty` and decrements `committedQty`.
  - Partial deliveries release exact delta commitments, preventing over-commitment drift.

### Gate 4: Four-Role End-to-End Lifecycle Run
- **Scope**: 29 live assertions via [`scripts/gate4-e2e-four-role-run.mjs`](file:///d:/NOTION/nirman/nirman/scripts/gate4-e2e-four-role-run.mjs) + interactive browser pass.
- **Invariants Verified**:
  - Full document progression: MR (Draft → Pending → Approved) → CC (Draft → Submitted → Approved) → PO (Draft → Submitted → Approved) → DC (Processing) → GRN (Delivered + Photo Proof Verified) → PO Closed.
  - Photo proof existence verified via `ctx.storage.getMetadata` before GRN creation.
  - Real browser UI rendering verified without console or index errors across all 4 dashboards.

---

## 4. Deferred Backlog Matrix

The following non-blocking improvements are formally scheduled for subsequent stages:

| Item | Area | Description | Target Stage | Justification / Migration Strategy |
|---|---|---|---|---|
| **H3** | Procurement | CC item quantities unbound to MR item caps | Stage 2 | Requires full RFQ splitting and multi-vendor partial quote allocation engine. |
| **H10** | Backend Scoping | Multi-project aggregation query streaming | Stage 3 | Compound indexed queries per project are bounded and performant for current tenant sizes. Pagination/streaming cursors will be added for large enterprise scale (100+ projects per PM). |
| **H11** | Mobile UX | Tables overflowing on mobile viewports (< 546px) | Stage 2 | Mobile-first card view transform scheduled for the supervisor mobile experience sprint. |
| **H12** | Navigation | Missing routes / 404 links on secondary sub-menus | Stage 2 | Navigation audit and routing consolidation sprint. |
| **H13** | Frontend DRY | Duplicate form input logic across document modals | Stage 2 | Component library unification using shared Radix document primitive. |
| **C6** | Styling | 29 files with raw Tailwind palette color classes | Stage 2 | Systematic migration of Tailwind color utilities to semantic CSS theme tokens (`--primary`, `--muted`, `--border`). |

---

## 5. Code Quality Metric Ratchet Baseline

Enforced in CI via `npm run check:metrics` ([`scripts/check-metrics.mjs`](file:///d:/NOTION/nirman/nirman/scripts/check-metrics.mjs)):

| Metric | Measured Value | Strict Ceiling | Status |
|---|---|---|---|
| **Files over 500 lines** | 15 files | `<= 15` | ✅ OK |
| **TypeScript `any` usages** | 136 usages | `<= 140` | ✅ OK |
| **Files with hardcoded colors** | 29 files | `<= 29` | ✅ OK |
| **Files with relative imports** | 16 files | `<= 19` | ✅ OK |

---

## 6. Sign-off

Stage 1 is complete, verified, and ready for deployment under release tag `v1.3.0`.
