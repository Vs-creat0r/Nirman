# Stage 5 Verification & Handover Record (v1.7.0)

**Date:** 05 Sep 2026  
**Target:** Stage 5 — RFQ Module, Path-1 Procurement Routing, GRN DocumentView Shell Migration & CC Snapshot Immutability  
**Baseline:** `7a62cbc` (v1.6.0)  
**HEAD Commit:** `04f2183` (Tag: `v1.7.0`)  

---

## 1. What Was Built & Verified

### A. RFQ & Quote Ledger (`contracts/rfq.json`, `contracts/rfq_quotes.json`)
- RFQ document lifecycle (`draft` → `open` → `closed` → `archived`).
- Vendor quote submission and immutable revision ledger (`supersededBy` chaining).
- Dedicated UI routes:
  - `/dashboard/procurement/rfqs` (RFQ master index)
  - `/dashboard/procurement/rfqs/new` (RFQ creation form)
  - `/dashboard/procurement/rfqs/[id]` (DocumentView shell detail, quote ledger, add-quote modal)
  - `/dashboard/manager/rfqs/[id]` (Manager DocumentView detail)

### B. Path-1 Procurement Routing
- Material Request routing from `ready_for_cc` (Approved):
  - **Path-0:** `send_to_cc` → `routed_to_cc` (Direct Cost Comparison)
  - **Path-1:** `send_to_rfq` → `routed_to_rfq` (Pre-fills RFQ with MR items & project)
- Document lineage linking across MR → RFQ → CC → PO → DC → GRN.

### C. GRN Migration to Universal DocumentView Shell
- Migrated `/dashboard/grn/[id]/page.tsx` from custom bespoke page to standard `DocumentView` shell (lines reduced from 646 → 91 lines).
- Photo grid and item discrepancy review rendered inside standard shell.

---

## 2. Test Verification & Code Quality Audit

### Test Suite Status: 18/18 Files Passed, 674/674 Tests Passed
- `tests/rfq_lifecycle.test.ts` (7 tests) — RFQ state machine integrity, outgoing exits, and role authorizations.
- `tests/path1_routing.test.ts` (4 tests) — MR `routed_to_rfq` / `routed_to_cc` routing transitions.
- `tests/rfq_scoping.test.ts` (5 tests) — Multi-tenant project/site isolation via production `assertDocumentAccess`.
- `tests/cc_from_rfq.test.ts` (4 tests) — Bound directly to production `processVendorQuotes` from `convex/cost_comparisons.ts`. Proves snapshot decoupling: editing/superseding a quote in `rfq_quotes` does not alter the CC embedded quote snapshot. Server enforces minimum 2 distinct vendors.

### Quality Ratchet Metrics (`scripts/check-metrics.mjs`):
- `filesOver500Lines`: 14 (within baseline <= 14)
- `anyUsages`: 98 (ratchet tightened from 105 to 102; 98 achieved)
- `filesWithHardcodedColors`: 0
- `filesWithRelativeImports`: 0
- `consoleCallsInConvex`: 0

### Regression Invariants:
- `scripts/gate3-parity-check.mjs` — Exit 0 (100% green across 18 contracts & all states).
- `scripts/gate3-path1-e2e.mjs` — Exit 0 (Path-0, Path-1, Standalone-RFQ simulation verified).

---

## 3. Commit Trail

Branch `feat/stage-5-rfq-path1` fast-forward merged to `main`:
1. `60b7958` — `feat(contracts): declare RFQ & RFQ Quotes contracts, Path-1 transitions and codegen`
2. `d7be845` — `feat(backend): implement RFQ mutators, quote ledger, scoping and permission matrix`
3. `af4de0d` — `feat(ui): migrate GRN to DocumentView shell, add RFQ pages and quote modal`
4. `0e453ce` — `test: add Stage 5 tests, Path-1 E2E regression and CC snapshot immutability verification`
5. `cfdb7d2` — `docs: document Path-1 procurement routing and promote RFQ to core pipeline`
6. `04f2183` — `test(cc_from_rfq): bind snapshot immutability test to production processVendorQuotes and schemas`

---

## 4. Final Deployment Steps (To Ship)

1. **Push to Remote:**
   ```powershell
   cd D:\NOTION\nirman\nirman
   git push origin main --tags
   ```
2. **Confirm Production Deploy:**
   - Verify Vercel build succeeds.
   - Confirm Convex backend schema and functions are updated.
3. **Live Route Walkthrough (Pre-Stage 6 Gate):**
   - Walk Path-0, Path-1, and Standalone RFQ on the deployed site.
   - Verify that editing a vendor quote on a closed RFQ does not alter an already-generated Cost Comparison.
