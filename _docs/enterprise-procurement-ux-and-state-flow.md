# Nirman ERP — Enterprise Procurement Flow & UX Architecture
### Best-Practice State Machine, Action Placement & Anti-Bug Design Guide

---

## 1. Executive Summary & Core Principles

In enterprise-grade procurement and ERP systems (such as **Procore, SAP Ariba, Coupa, Autodesk Construction Cloud, and Stripe**), documents represent commercial liabilities, contractual obligations, and auditable physical inventory. 

A high-quality ERP prevents "silly bugs" (stale action prompts, competing buttons, accidental deletions, orphan drafts) by enforcing **three fundamental invariants**:

1. **The "Single Ball-in-Court" (BIC) Invariant:**  
   At any point in time, an action is required by exactly **one role**. The moment a user initiates downstream work (e.g. creating a draft Cost Comparison for an approved Material Request), the parent document is immediately removed from "Action Required" inboxes across all dashboards.
2. **The "Clean Grid / Focused Dialog" Action Hierarchy:**  
   Data table rows must have **one clear primary action** (e.g. `Edit` for drafts, `Review` for pending approvals, `View` for finalized records). Destructive actions (`Delete Draft`, `Discard`) must **never** sit directly on dense table cells alongside primary buttons. They belong inside the **Edit Modal / Detail Form (bottom-left danger zone)** or an overflow (`···`) menu, gated by a two-step confirmation.
3. **The "Universal Mutability Matrix":**  
   Every document stage strictly adheres to immutable state rules:  
   `Draft` (mutable, discardable) $\rightarrow$ `Submitted` (locked to author, reviewable by manager) $\rightarrow$ `Queried` (editable & resubmittable) $\rightarrow$ `Approved` (immutable, trigger downstream) $\rightarrow$ `Closed/Delivered` (terminal audit record).

---

## 2. Document Action Placement & UI Hierarchy

### A. Data Table Actions Column (Grid View)
In enterprise software, dense tables should never display multiple competing buttons per row.

```
❌ BAD (Cluttered & Error-Prone):
| Reference    | Project   | Status | Action                       |
| CC-2026-0004 | HQ Tower  | Draft  | [Edit]  [Delete]  [View]     |  <-- Accidental clicks, visual noise

✅ ENTERPRISE STANDARD (Clean, Intentional & Safe):
| Reference    | Project   | Status | Action                       |
| CC-2026-0004 | HQ Tower  | Draft  | [Edit Draft →]               |  <-- Single clear primary intent
| CC-2026-0003 | HQ Tower  | Review | [Review & Approve →]        |
| CC-2026-0002 | HQ Tower  | Active | [View Details]               |
```

### B. Edit Modal / Full Form Action Footer
Destructive actions are isolated to the left of the modal/page footer to prevent misclicks, while positive progression actions are grouped on the right.

```
+-----------------------------------------------------------------------------------+
|  Edit Cost Comparison Draft (CC-2026-0004)                                    [✕] |
|-----------------------------------------------------------------------------------|
|  [ Form fields, vendor quotes, rates, commercial terms... ]                       |
|                                                                                   |
|-----------------------------------------------------------------------------------|
|  [🗑️ Discard / Delete Draft]                           [Save Draft]  [Submit PO →] |
|  (Left: Isolated Destructive)                         (Right: Progression Actions)|
+-----------------------------------------------------------------------------------+
```

---

## 3. End-to-End State Machine & Action Matrix

| Stage | Document | Current Status | Who Holds Action? | Allowed Row Action (Grid) | Allowed Detail / Modal Actions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. MR** | Material Request | `draft` | Site Supervisor | `Edit Draft` | `Save Draft`, `Submit for Review`, `Delete Draft` (bottom-left) |
| **1. MR** | Material Request | `pending` | Project Manager | `Review Request` | `Approve`, `Reject (note)`, `Query (note)` |
| **1. MR** | Material Request | `queried` | Site Supervisor | `Edit & Resubmit` | `Save Changes`, `Resubmit for Approval` |
| **1. MR** | Material Request | `ready_for_cc` | Procurement Officer | `Create CC` | *Removed from Action Required once CC draft exists* |
| **2. CC** | Cost Comparison | `draft` | Procurement Officer | `Edit Quotes` | `Save Draft`, `Submit for Manager Review`, `Delete Draft` |
| **2. CC** | Cost Comparison | `submitted` | Project Manager | `Review & Select` | `Approve & Select Vendor`, `Reject`, `Query` |
| **2. CC** | Cost Comparison | `queried` | Procurement Officer | `Edit & Resubmit` | `Save Quotes`, `Resubmit for Review` |
| **2. CC** | Cost Comparison | `approved` | Procurement Officer | `Generate PO` | *Removed from Action Required once PO draft exists* |
| **3. PO** | Purchase Order | `draft` | Procurement Officer | `Edit Draft` | `Save Draft`, `Submit for Approval`, `Delete Draft` |
| **3. PO** | Purchase Order | `submitted` | Project Manager | `Review PO` | `Authorize & Issue PO`, `Reject`, `Query` |
| **3. PO** | Purchase Order | `queried` | Procurement Officer | `Edit & Resubmit` | `Save PO`, `Resubmit for Authorization` |
| **3. PO** | Purchase Order | `approved` | Procurement Officer | `Dispatch Delivery` | *Triggers Delivery Challan generation* |
| **4. DC** | Delivery Challan | `delivery_processing`| Site Supervisor | `Confirm Receipt` | `Verify Quantities`, `Upload Photos`, `Generate GRN` |
| **5. GRN**| Goods Receipt Note | `delivered` | All (Audit) | `View Receipt` | `View Unloading Proof Photos`, `Lineage Stepper` |

---

## 4. Anti-Bug Backend Architectural Patterns

To permanently eliminate stale prompts, ghost entries, and query mismatches:

### 1. The Downstream-Exclusion Pattern (Zero-Ghost Inboxes)
Whenever a query fetches items for an "Action Required" banner (e.g. Approved MRs waiting for CC, or Approved CCs waiting for PO), it **must check for existing downstream documents in ANY active status** (`draft`, `submitted`, `approved`).

```typescript
// ✅ Correct Pattern: Centralized & Mutually Exclusive
export const listApprovedMRsAwaitingCC = query({
  handler: async (ctx) => {
    const mrs = await ctx.db
      .query("material_request")
      .withIndex("by_status", (q) => q.eq("status", "ready_for_cc"))
      .collect();

    // Exclude any MR that already has a downstream Cost Comparison
    const pendingMRs = await Promise.all(
      mrs.map(async (mr) => {
        const hasCC = await ctx.db
          .query("cost_comparison")
          .withIndex("by_materialRequestId", (q) => q.eq("materialRequestId", mr._id))
          .filter((q) => q.neq(q.field("status"), "rejected"))
          .first();
        return hasCC ? null : mr;
      })
    );

    return pendingMRs.filter(Boolean);
  },
});
```

### 2. Single-Helper Mutability Guards (Draft vs. Queried)
Mutations that allow editing must explicitly support **both `draft` and `queried`** source states without throwing invalid transition errors:

```typescript
// ✅ Correct Pattern: Polymorphic Draft/Queried Update
export const updateOrResubmitDocument = mutation({
  handler: async (ctx, args) => {
    // Allows updating while preserving draft status OR promoting queried -> submitted
    const doc = await ctx.db.get(args.id);
    if (doc.status !== "draft" && doc.status !== "queried") {
      throw new Error(`Document cannot be edited in "${doc.status}" state.`);
    }

    const nextStatus = args.submitImmediately 
      ? (doc.status === "queried" ? "submitted" : "submitted")
      : doc.status; // remain draft if just saving

    return await transition(ctx, {
      table: "purchase_order",
      documentId: args.id,
      from: ["draft", "queried"],
      to: nextStatus,
      ...
    });
  }
});
```

### 3. Computed Status Aggregates in Backend (e.g. GRN Discrepancies)
Never compute critical operational flags exclusively on the client. The backend query must enrich the payload with pre-calculated flags:

```typescript
// ✅ Correct Pattern: Backend-Computed Discrepancy & Health Checks
const enrichedGRNs = grns.map((grn) => {
  const hasDiscrepancy = grn.receivedItems.some(
    (item) => item.receivedQty < item.expectedQty
  );
  return {
    ...grn,
    hasDiscrepancy,
  };
});
```

---

## 5. UI/UX Implementation Checklist

- [ ] **Table Action Column:** Single contextual button per row (`Edit Draft` for drafts, `Review` for pending, `View` for active).
- [ ] **Delete Draft Placement:** Placed on the bottom-left of the Edit Modal / Detail Page in red/danger style, accompanied by `window.confirm` or a Dialog modal.
- [ ] **Empty Rate Inputs:** Rate fields initialize as blank (`placeholder="Enter rate"`), not `0`, so amounts show `—` until user input.
- [ ] **Inbox Mutual Exclusivity:** All Dashboard KPI queries and Action Required banners filter out parent items as soon as a child draft is created.
- [ ] **Role-Based Guards:** Non-authors and non-approvers see read-only view modes automatically.
