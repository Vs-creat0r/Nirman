# Nirman — Construction Site ERP (v1.0.0) Handover Document

> **Target Accomplished:** Production-ready, database-backed procurement spine built on Next.js 16 (App Router), Convex real-time backend, and TailwindCSS design system.

---

## 1. What Shipped (v1.0.0 Core Deliverables)

### 🔐 1. Authentication & Server-Side RBAC
- **4 Dedicated Roles** with strictly enforced server-side `requireRole()` guards on every mutation:
  - **Site Supervisor**: `supervisor` / `supervisor123` (Dashboard: `/dashboard/supervisor`)
  - **Project Manager**: `manager` / `manager123` (Dashboard: `/dashboard/manager`)
  - **Procurement Officer**: `procurement` / `procurement123` (Dashboard: `/dashboard/procurement`)
  - **System Admin**: `admin` / `admin123` (Dashboard: `/dashboard/admin`)
- Native session tokens stored in secure, HTTP-only cookies with automatic server identity verification.

---

### 🔄 2. The Complete Procurement Spine (End-to-End)

```
[1. Material Request] ──▶ [2. Manager Approval] ──▶ [3. Cost Comparison (≥2 quotes)] ──▶ [4. Vendor Selection & PO]
                                                                                                  │
[7. Loop Closed: 'Delivered'] ◀── [6. Auto-GRN + Unloading Photos] ◀── [5. Delivery Challan Dispatch] ◀───┘
```

1. **Material Request (`material_request`)**:
   - Raised by Site Supervisor for active project sites.
   - Manager approval queue with **Approve** (`ready_for_cc`), **Reject** (`rejected`), or **Query with Notes** (`queried`).
   - Queried request edit-and-resubmit loop.
2. **Cost Comparison (`cost_comparison`)**:
   - Created by Procurement Officer directly from approved MR (items auto-filled with zero re-entry).
   - Side-by-side multi-vendor quote comparison table with tax, freight, and grand totals.
   - Strict server-side validation enforcing a minimum of **2 vendor quotes**.
   - Project Manager approves by selecting the winning vendor (`ready_for_po`).
3. **Purchase Order (`purchase_order`)**:
   - Auto-generated from approved CC with snapshotted line items, winning vendor rates, and commercial terms.
   - Terms & Conditions template selection + custom terms editor.
   - Submitted by Procurement Officer (`review_po`) $\rightarrow$ Approved by Project Manager (`pending_po`).
4. **Delivery Challan (`delivery_challan`)**:
   - Created against approved PO (`/dashboard/deliveries`).
   - Supports **Partial Deliveries & Multi-DC Trips**: Dispatches multiple challans against a single PO while tracking remaining balances per line item.
   - Strict server-side prevention of over-delivery / over-dispatch.
   - Records Vehicle Registration Number, Driver Name, Driver Contact, Dispatch Date, and Expected Arrival Date.
   - Dispatches shipment to `delivery_processing` $\rightarrow$ Site Supervisor instantly sees "Out for Delivery" on their dashboard.
5. **Goods Receipt Note (`grn`)**:
   - Auto-generated upon on-site delivery confirmation — **never a manual form**.
   - Physical item quantity reconciliation table with discrepancy highlights and strict over-delivery rejection.
   - Mandatory unloading proof photo uploads via Convex built-in file storage (`_storage`).
   - Cumulative item reconciliation across multiple GRNs:
     - If partially delivered, updates PO `deliveredQty`/`pendingQty` while keeping the Material Request open in `delivery_processing`.
     - If all items are 100% fulfilled across batches, transitions DC, PO, and MR to `delivered` — **closing the loop**.

---

### 📜 3. Universal Audit Trail & Lineage
- **System Audit Logs (`/dashboard/logs`)**:
  - Cryptographic chronological log of every transition, actor, timestamp, and review note.
  - Multi-field filtering by Reference ID, Document Type, and Role.
  - **Clickable Reference IDs**: Direct navigation from any log entry to the corresponding document screen.
- **Universal Document Lineage Bar**: 5-stage visual progress tracker (MR $\rightarrow$ CC $\rightarrow$ PO $\rightarrow$ DC $\rightarrow$ GRN) on all document views.

---

### 🏢 4. Master Data & Settings
- **Vendor Master (`/dashboard/procurement/vendors`)**:
  - Full CRUD operations with strict case-insensitive name uniqueness check.
  - Aggregated analytics (total POs issued, approved spend, contact info).
- **Company Profile & Terms Templates (`/dashboard/admin/settings`)**:
  - Organization billing profile, GSTIN, and address configuration.
  - Reusable procurement Terms & Conditions templates.
- **User Control Panel (`/dashboard/users`)**:
  - Active user directory and role permissions reference.

---

## 2. Architecture & Design Decisions

| Decision | Implementation | Rationale |
|---|---|---|
| **D1: Auth** | Native Convex sessions with HTTP-only cookies | Eliminates external JWT provider setup while supporting admin-provisioned accounts. |
| **D2: File Storage** | Convex built-in storage (`ctx.storage`) | Zero third-party CORS configuration; seamless upload URL generation and CDN resolution. |
| **D3: Data Contracts** | Generated from `contracts/*.json` | Single source of truth for schema validators, indexes, and UI field schemas. |
| **D4: State Engine** | Centralized `transition()` mutation helper | Guaranteed audit log entry on every status update with zero duplicate code. |
| **D5: Aesthetics** | Curated HSL tokens in `globals.css` | 100% compliance with `theme-rules.md` in both Light and Dark mode without hardcoded hex values. |

---

## 3. Known Limitations & Deferred Items

The following items were intentionally deferred from the 4-day solo sprint to protect core pipeline reliability:

1. **BOQ "Send to Procurement" 3-Way Direct Routing**: Direct tender routing to RFQ/PO/DC is queued for Sprint 2.
2. **RFQ External WhatsApp/Email Automated Webhook**: Manual RFQ contract is defined in schema; automated vendor quote collection is queued for Sprint 2.
3. **PDF Document Generation**: Print stylesheets provide clean export; jsPDF engine queued for Sprint 2.

---

## 4. Sprint 2 Priority Roadmap

1. **RFQ + WhatsApp / Email Quote Ingestion**: Vendor portal / pre-filled WhatsApp links.
2. **Path 1 BOQ Direct Routing**: "Send to Procurement" 3-way routing from master tender list.
3. **Partial Delivery & Pending POs**: Multi-challan quantity remainder ledger.
4. **Automated Site & Warehouse Inventory**: Live stock deductions on consumption.
5. **PDF Export Engine**: Standardized procurement printouts.
6. **Cloudflare R2 Migration**: Component swap via `@convex-dev/r2`.

---

*Handover report prepared for Nirman Construction Site ERP v1.0.0.*
