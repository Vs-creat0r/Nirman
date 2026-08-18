# Phase 2 — MVP (Minimum Viable Product)

> Goal: The full procurement pipeline is operational — from Site Supervisor creating a material request to GRN confirmation after delivery. Vendor management is live. The system is usable by all three core roles.

> Prerequisite: Phase 1 (Setup) must be complete.

---

## Deliverables

At the end of this phase:
- A Site Supervisor can create a material request and track it through to delivery.
- A Project Manager can approve/reject requests, CCs, and review POs.
- A Procurement Officer can create RFQs, Cost Comparisons, Purchase Orders, and Delivery Challans.
- All document types use the Universal Document Form.
- Vendor management is functional with uniqueness enforcement.
- Real-time status updates work across all dashboards.

---

## Features

### 1. Database Schema (Convex)
1. Define `projects` table: name (unique), sites[], tenderPdfUrl, items[], createdBy, status.
2. Define `projectItems` table: projectId, name, unit, qty, addedBy, timestamps. *(The master tender/BOQ item list per project.)*
3. Define `requests` table: site, project, items[], status, createdBy, assignedTo, notes, timestamps.
4. Define `rfqs` table: linkedRequestIds[], projectItemIds[], vendorIds[], status, createdBy, notes.
5. Define `costComparisons` table: rfqId, vendorQuotes[], selectedVendorId, status, approvedBy, queryNotes, rejectionReason.
6. Define `purchaseOrders` table: ccId, vendorId, lineItems[], paymentTerms, status, pdfUrl, deliveredQty, pendingQty.
7. Define `deliveryChallans` table: poId, vehicleNo, driverName, dispatchedItems[], isPartial, expectedArrival, status.
8. Define `grns` table: poId, receivedItems[], photos[], invoiceNumber, confirmedBy, confirmedAt. *(Auto-created on "Delivered" click.)*
9. Define `vendors` table: name (unique), contact, gstNo, address, category, isActive.
10. Define `logs` table: actorId, action, documentType, documentId, referenceId, timestamp.
11. Define `settings` table: requireManagerApprovalForRequests (boolean, default true).

### 2. Universal Document Form
1. Create `components/document/document-form.tsx` — smart shell that accepts `type` and `mode` props.
2. Create `components/document/document-header.tsx` — title, type badge, back button, action buttons.
3. Create `components/document/document-meta.tsx` — status badge, created by, date, document ID.
4. Create `components/document/document-footer.tsx` — cancel + submit buttons.
5. Create per-type body components in `components/document/bodies/` (6 files — one per document type).

### 3. Material Request (Site Supervisor)
1. Create `app/(dashboard)/site/requests/page.tsx` — list of own requests with status badges.
2. "New Request" opens Universal Document Form (type: MATERIAL_REQUEST, mode: create).
3. Implement `convex/requests.ts`: `createRequest`, `getMyRequests`, `updateRequest`, `submitRequest`.
4. Submitted request creates in-app notification for all Project Managers.
5. "Query" status allows Site Supervisor to edit and resubmit.

### 4. Project Manager — Approvals
1. Create `app/(dashboard)/manager/approvals/page.tsx` — pending request list.
2. Click request → Universal Document Form (type: MATERIAL_REQUEST, mode: view).
3. Action buttons: **Approve**, **Query** (resend for updation or changes) **Reject** (with reason modal).
4. Approval changes status to `ready_for_cc`; a "Create CC" button becomes available on the request.
5. Direct PO shortcut: skip CC, go directly to PO creation.
6. **Bypass Setting:** Add a configuration toggle on the Manager dashboard: "Require Approval for New Requests". If toggled OFF, requests submitted by the Site Supervisor go straight to `ready_for_cc` for the Procurement Officer.

### 5. Project Page — Master Item List (Tender/BOQ)
1. Create `app/(dashboard)/projects/[id]/page.tsx` — project detail page.
2. Project page has an information panel ("i" icon) showing project meta: name, site, tender PDF link.
3. Tender PDF upload on project creation — stored in Convex file storage for reference.
4. **Item List section**: Users can add items one by one (name, description, quantity, unit, category, sub-category, ). Items are stored in `projectItems` table.
5. Each item row has a hover-reveal checkbox for selection.
6. Select one or more items → **"Send to Procurement"** button appears at bottom of list.
7. "Send to Procurement" opens a modal with three options:
   - **RFQ**: Item details auto-filled into a new RFQ → saved to RFQ list page.
   - **Purchase Order**: Vendor selection dropdown appears → item details auto-filled into a new PO.
   - **Delivery Challan**: Item details auto-filled into a new DC → saved to Delivery page.
8. Implement `convex/projects.ts` and `convex/projectItems.ts`.
9. Smart item autocomplete (from global inventory + project item list) when adding new items.

### 6. Vendor Management
1. Create `app/(dashboard)/supply/vendors/page.tsx` — vendor list with search and filter (under Supply section).
2. Add Vendor form: name (uniqueness check), contact, GST, address, category.
3. Edit / Deactivate vendor actions.
4. Implement `convex/vendors.ts`: `createVendor`, `getVendors`, `updateVendor`, `deactivateVendor`.
5. Dropdown sorting: in all vendor selection dropdowns, already-selected vendors appear at top.

### 7. Cost Comparison (Procurement Officer)
1. Create `app/(dashboard)/procurement/cost-comparison/page.tsx` — CC queue (accessible from RFQ list via "Create CC" button).
2. Universal Document Form (type: COST_COMPARISON): multi-vendor quote entry table.
3. Vendor quotes are **auto-filled from the linked RFQ** — user edits price, tax, and delivery terms.
4. Minimum 2 vendor quotes required — enforce at form level.
5. Submit CC → status `review_cc` → pending Manager review.
6. Manager actions on CC: **Approve** (select vendor → `ready_for_po`) | **Query** (relisted in RFQ for revision) | **Reject** (stored as rejected).

### 8. RFQ (Request for Quotation)
1. Create `app/(dashboard)/procurement/rfqs/page.tsx`.
2. Group multiple approved requests or project items into one RFQ batch.
3. Universal Document Form (type: RFQ): vendor selection with already-added grouping.
4. **Send to vendor**: WhatsApp or Email button — redirects to WhatsApp with vendor number and pre-filled message. No API required.
5. **"Create CC" button** visible on each RFQ row after submission.
6. Excel export of RFQ data.
7. Implement `convex/rfqs.ts`.

### 9. Purchase Order
1. Create `app/(dashboard)/procurement/purchase-orders/page.tsx` — all POs in creation and approval stage.
2. Create `app/(dashboard)/procurement/pending-purchase-orders/page.tsx` — approved POs waiting for delivery or partially delivered.
3. Universal Document Form (type: PURCHASE_ORDER): vendor info, line items (auto-filled from CC), payment terms.
4. Auto-generate PDF on PO creation.
5. Status: `review_po` after creation (pending Manager review).
6. Manager actions on PO: **Approve** (`pending_po`) | **Query** (relisted for revision) | **Reject** (items back to prior state).
7. Track `deliveredQty` vs `pendingQty` per line item for partial delivery tracking.

### 10. Delivery Challan
1. Create `app/(dashboard)/procurement/delivery/page.tsx` — all deliveries (partial or full).
2. Universal Document Form (type: DELIVERY_CHALLAN): vehicle, driver, items dispatched, expected arrival.
3. **Partial quantity support**: user enters dispatched qty; if less than PO qty, remaining stays in Pending POs.
4. Status → `delivery_processing` (site sees "Out for Delivery").
5. Implement `convex/deliveryChallans.ts`.

### 11. GRN (Goods Receipt Note)
1. Site Supervisor sees "Out for Delivery" requests on their dashboard.
2. Anyone (Site Supervisor, Procurement Officer) clicks **"Delivered"** button on the delivery.
3. A prompt appears to **upload unloading photos** (required).
4. GRN is **automatically created and auto-filled** — no manual form submission needed.
   - Auto-filled: GRN Number, Vendor Name, Items, Quantity, PO/RFQ Date, Delivery Date, Invoice Number (if available), Photos, Confirmed By.
5. Status → `delivered`.
6. GRN appears in **Supply → GRN** page.
7. Notification to Procurement Officer confirming delivery.
8. Implement `convex/grn.ts`.

### 12. Dashboard Summary Cards
1. Site dashboard: Active Requests, Deliveries Today.
2. Manager dashboard: Pending Approvals, Deliveries In Progress.
3. Procurement dashboard: Pipeline view — count at each stage (RFQ, CC Review, PO Review, Pending POs, Delivery).
4. All cards use real-time Convex queries — auto-update without refresh.

### 13. Logs (Supply → Logs)
1. Create `app/(dashboard)/supply/logs/page.tsx`.
2. Every system action is recorded: document created, status changed, approval given, delivery confirmed, etc.
3. Each log entry shows: actor, action, document type, timestamp.
4. Each log entry has a **Reference ID with a clickable link** that opens the source document directly.
5. Implement `convex/logs.ts`: auto-write a log entry on every significant mutation.

---

## Verification

- [ ] Site Supervisor can create and submit a material request.
- [ ] Purchase Officer and Project Manager can create and sees the request in their queue(sent by Site Supervisor) and Project Manager have to approve it if created by Site Supervisor and Purchase Officer but if Project Manager has created then no approval required.
- [ ] Purchase Officer and Project Manager can create a CC with 2+ vendor quotes, If created by Purchase officer then approval required but if Project Manager has created then no approval required.
- [ ] Project Manager can select a vendor from the CC and approve, query(require to change rates and kind of and recreate the same), reject(no further process).
- [ ] Purchase Officer and Project Manager can create a PO — PDF generates, If created by Purchase officer then approval required but if Project Manager has created then no approval required.
- [ ] Project Manager can select a PO and approve, query(require to change rates and kind of and recreate the same), reject(no further process, Fallback that items that are added from the inventory or project into its current state or I can say minus it.).
- [ ] Procurement Officer and Project Manager can create a DC — PDF generates, site sees "Out for Delivery", If created by Purchase officer then approval required but if Project Manager has created then no approval required.
- [ ] Site Supervisor can confirm receipt via that request — status becomes "Delivered".
- [ ] Vendor uniqueness check prevents duplicate vendor names.
- [ ] Already-added vendors appear at top of selection dropdowns.
- [ ] Dark mode / light mode works on all new pages.
- [ ] All new components use Universal Document Form — no one-off layouts.