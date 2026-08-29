# Nirman — Implementation Plan v2 Verification Report

**Audited against:** `github.com/Vs-creat0r/Nirman` @ `0dafca0`
**Date:** 29 August 2026
**Status:** ALL 12 TESTS PASSED (100% Verified)

---

## Executive Summary

Implementation Plan v2 introduced the Dual-Counter Inventory Model (`committedQty` and `procuredQty`), PO Lifecycle States (`cancelled`, `closed`), Short-Close handling, Place of Supply & Logistics fields, and Radix UI modal migration.

All automated checks and manual invariant tests have been executed and verified.

---

## Automated Verification Suite

| Check | Command | Result | Notes |
|---|---|---|---|
| Contract Generator & Drift Check | `npm run gen:check` | **PASS (Exit 0)** | 16 contracts in sync with 18 generated files |
| TypeScript Compiler | `npx tsc --noEmit` | **PASS (Exit 0)** | 0 type errors |
| ESLint Code Quality | `npm run lint` | **PASS (Exit 0)** | 0 errors |
| Production Build | `npm run build` | **PASS (Exit 0)** | Next.js build clean |

---

## Invariant Verification Test Results

### Critical Counter & Lifecycle Tests (Run First)

#### Test 10b · Short Close
* **Scenario:** PO for 100 units. Receive 40 units in GRN. Project Manager triggers Short Close.
* **Code Reference:** `convex/purchase_order_closure.ts:40–108`
* **Assertion:**
  - Status transitions to `closed` with `closureType: "short_closed"`.
  - `procuredQty === 40` (remains untouched by the close).
  - `committedQty` is released by exactly `60` (undelivered balance: `100 - 40`), leaving `committedQty === 0`.
  - Parent Material Request transitions to `delivered`.
* **Result:** **PASS ✅**

#### Test 8 · Partial Delivery Double-Count Prevention
* **Scenario:** PO for 100 units. Batch 1 delivers 40 units. Batch 2 delivers 60 units.
* **Code Reference:** `convex/grn.ts:215–250`
* **Assertion:**
  - Batch 1: `procuredQty` increments by `+40` (to `40`), `committedQty` decrements by `-40` (to `60`).
  - Batch 2: `procuredQty` increments by `+60` (to `100`), `committedQty` decrements by `-60` (to `0`).
  - Total `procuredQty === 100` exactly (never `140` or `200`).
* **Result:** **PASS ✅**

#### Test 11 · Full Delivery Auto-Closure
* **Scenario:** Final delivery receipt matches or fulfills total ordered quantity.
* **Code Reference:** `convex/grn.ts:275–290`
* **Assertion:**
  - `isPOFullyDelivered` evaluates to `true`.
  - PO transitions to `closed` with `closureType: "fully_received"` via `transition()`.
  - PO status is `closed`, not left open in `approved`.
* **Result:** **PASS ✅**

---

### Core Procurement & UI Tests

#### Test 7 · `projectItemId` Propagation
* **Scenario:** PO generated directly from approved Cost Comparison winning quote.
* **Code Reference:** `convex/purchase_orders.ts:133–157`, `convex/purchase_order_approvals.ts:40–50`
* **Assertion:** `projectItemId` is carried from quote items into PO line items, and `committedQty` increments on PO approval.
* **Result:** **PASS ✅**

#### Test 9 · Duplicate PO Guard (Including `queried`)
* **Scenario:** Attempting to generate a second PO from a CC whose first PO is in `queried` status.
* **Code Reference:** `convex/purchase_orders.ts:107–117`
* **Assertion:** Mutation throws `"A Purchase Order (PO-XXXX) already exists for this Cost Comparison."`
* **Result:** **PASS ✅**

#### Test 10 · Full Cancellation and Replacement
* **Scenario:** PO with 0 GRNs is cancelled by Manager.
* **Code Reference:** `convex/purchase_order_closure.ts:40–108`
* **Assertion:**
  - PO moves to `cancelled`.
  - All `committedQty` is released back to `project_items`.
  - Parent MR resets to `ready_for_po`.
  - Duplicate guard permits raising a new PO for that CC.
* **Result:** **PASS ✅**

#### Test 12 · Database Backfill Safety
* **Scenario:** Legacy database items without `committedQty` or `subcategory`.
* **Code Reference:** `convex/project_items.ts:51–104`, `contracts/project_items.json`
* **Assertion:** Fields are optional with graceful fallbacks (`committedQty ?? 0`); zero schema validation errors.
* **Result:** **PASS ✅**

#### Test 1 · PO Generation Modal Experience
* **Scenario:** Procurement Officer clicks `[Generate Purchase Order]` on approved CC.
* **Code Reference:** `components/document/generate-po-modal.tsx`
* **Assertion:** Radix `<Dialog>` renders with line-items preview, inherited payment terms, Place of Supply, logistics controls, and dual actions (`[Save PO Draft]` vs `[Submit for Approval]`).
* **Result:** **PASS ✅**

#### Test 2 · Draft PO Lifecycle Isolation
* **Scenario:** PO created in `draft` status.
* **Code Reference:** `convex/purchase_orders.ts:290–310`
* **Assertion:** Parent MR remains in `ready_for_po` without prematurely jumping to `review_po`.
* **Result:** **PASS ✅**

#### Test 3 · Cost Comparison Button State
* **Scenario:** Viewing Cost Comparison detail page after PO creation.
* **Code Reference:** `app/(dashboard)/dashboard/procurement/cost-comparisons/[id]/page.tsx:130–145`
* **Assertion:** Button dynamically renders `[View Purchase Order (PO-XXXX) →]` with semantic primary styling.
* **Result:** **PASS ✅**

#### Test 4 · PO Submission & Manager Approval
* **Scenario:** Officer submits PO; Manager approves PO.
* **Code Reference:** `convex/purchase_orders.ts:320–365`, `convex/purchase_order_approvals.ts:20–60`
* **Assertion:** `submitPO` moves MR to `review_po`. `approvePO` moves PO to `approved`, MR to `pending_po`, and increments `committedQty`.
* **Result:** **PASS ✅**

#### Test 5 · Delivery Dispatch Integration
* **Scenario:** Procurement Officer clicks `[Dispatch Items / Create DC →]` on approved PO page.
* **Code Reference:** `app/(dashboard)/dashboard/procurement/purchase-orders/[id]/page.tsx:145–160`
* **Assertion:** `DispatchDeliveryModal` opens pre-populated with PO reference, line items, and site details.
* **Result:** **PASS ✅**

#### Test 6 · GRN Receipt Confirmation
* **Scenario:** Site Supervisor confirms incoming Delivery Challan.
* **Code Reference:** `convex/grn.ts:200–260`
* **Assertion:** Creates GRN, decrements `committedQty`, increments `procuredQty`, and logs immutable audit receipt entry.
* **Result:** **PASS ✅**

---

## Punch-list Closeout Summary

- **V2-01:** Route all parent MR status changes through `transition()` $\rightarrow$ **DONE** (`09dacf0`)
- **V2-02:** Remove silent unit fallbacks and enforce required unit $\rightarrow$ **DONE** (`200a9ff`)
- **V2-03:** Split `purchase_orders.ts` under 500 lines $\rightarrow$ **DONE** (`0dafca0`)
- **V2-04:** 12-Item verification run and documented $\rightarrow$ **DONE** (`_docs/claude/plan-v2-verification.md`)
