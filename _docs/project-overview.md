# Project Overview

## Project Name
**[Company Name] — Construction Site ERP Platform**

> ⚠️ Replace `[Company Name]` with the actual company name before development begins.

---

## Purpose & Problem Statement

This platform is an enterprise-grade, internal ERP (Enterprise Resource Planning) system designed for **construction site operations management**. It solves the core operational challenge of coordinating material procurement between construction sites and the corporate procurement team — eliminating manual paperwork, delayed approvals, and lack of visibility across the supply chain.

The system acts as the **central nervous system** between:
- Active construction sites (field personnel)
- Project management (oversight and approvals)
- Corporate procurement (purchasing and vendor management)

---

## Business Goals

1. **Eliminate manual procurement workflows** — Replace phone calls, WhatsApp messages, and physical paperwork with a structured digital system.
2. **Enforce approval chains** — Material requests must pass through defined approval stages before procurement action is taken.
3. **Full supply chain visibility** — From material request creation at site, all the way to delivery confirmation and GRN.
4. **Centralized vendor management** — Maintain a live vendor database with quote history and performance tracking.
5. **Dynamic Procurement Routing** — From the master tender/item list, items can be dynamically routed directly to RFQ, PO (if a vendor is already selected), or Delivery Challan (if available in internal inventory or not).
6. **Audit trail** — Every action is logged with timestamps and user identity.

---

## Core Users (Roles)

### 1. Site Supervisor (formerly "Site Engineer")
- Works at the construction site
- Creates material requests
- Tracks delivery status
- Confirms goods receipt (GRN)
- Views own request history

### 2. Project Manager (formerly "Manager")
- Reviews and approves/rejects material requests
- Reviews and approves Cost Comparisons (selects vendor)
- Has full visibility of all site operations under their purview
- **Can directly create documents (RFQ, PO, DC) — no request needed**

### 3. Procurement Officer (formerly "Purchase Officer")
- Manages the procurement pipeline
- Creates RFQs, Cost Comparisons, Purchase Orders, Delivery Challans
- Manages vendor relationships
- **Submits actions as requests** — final approval rests with Project Manager

### 4. Admin (System Administrator)
- Manages users, roles, and system settings
- Not involved in procurement workflows directly

> **Future Roles (Planned — Not in MVP)**:
> - Inventory Manager — manages stock levels post-delivery
> - Project Controller / Accountant — handles billing, labor costing, material consumption tracking

---

## Core Modules (Phased)

### Phase 1 — MVP (Core Procurement Pipeline)
| Module | Description |
|---|---|
| Material Request | Site Supervisor creates requests for site materials |
| Manager Approval | Project Manager approves/rejects material requests |
| Cost Comparison (CC) | Procurement Officer gets vendor quotes, Manager selects vendor |
| Purchase Order (PO) | Procurement Officer issues formal purchase order to vendor |
| Delivery Challan (DC) | Tracks dispatch and delivery of purchased goods |
| GRN (Goods Receipt Note) | Site confirms receipt; closes the request loop |
| Vendor Management | Manage supplier database, contacts, and history |

### Phase 2 — Enhanced Operations
| Module | Description |
|---|---|
| Inventory Management | Track on-site and warehouse stock levels post-delivery |
| RFQ (Request for Quotation) | When the user clicks the Request for Quotation - send button, chose mail or whatsapp if choose icon; they are redirected to WhatsApp, which opens the vendor’s number and a pre‑filled message. No API key is required; the user can send the message manually. First redirect to WhatsApp, then handle the remaining steps. will do all other things.  |

### Phase 3 — Project Intelligence (Future)
| Module | Description |
|---|---|
| Project Management | Site progress tracking, milestone management |
| Labor Posting / Agency Billing | Track labor agencies, manpower, billing, and credit |
| Material Consumption Tracking | How much material is assembled/used day-by-day |
| Accountant Role & Financial Views | Balance sheets, pending payments, cost reports |

---

## Key Business Rules

### Request & Approval Logic
- **Site Supervisors** can only **create requests** — they cannot approve, create POs, or issue deliveries.
- **Procurement Officers** can create procurement documents (RFQ, CC, PO, DC) but these flow as **proposals** — the **Project Manager must approve** before finalization.
- **Project Managers** can **directly create** any document (RFQ, PO, DC, CC) **without going through the request flow** — their action is immediately finalized.
- A Project Manager **can create a material request** — if they create it, it is auto-approved.
- **Bypass Setting:** Managers have a configuration toggle: "Require Manager Approval for Site Requests". If toggled OFF, new requests from Site Supervisors automatically bypass the manager's approval queue and go straight to the Procurement Office (`ready_for_cc`).

---

### Path 1: Project Item Routing ("Send to Procurement")
Procurement Officer or Manager selects one or more items from the **Project's Master Item List** (Tender/BOQ list) and clicks **"Send to Procurement"**, routing them down one of three direct paths:

1. **→ RFQ**: No inventory available; fresh vendor quotes needed. Item details are auto-filled into a new RFQ. After submission, a **"Create CC"** button appears on the RFQ list page.
2. **→ Purchase Order**: A vendor is already selected/negotiated. Item details are auto-filled into a new PO. CC and RFQ are **skipped entirely**. After PO approval, continues to Delivery Challan → GRN.
3. **→ Delivery Challan**: Item is already available in the office or inventory. A DC is created directly — no RFQ, no CC, no PO required.

---

### Path 2: Default Flow (Request from Scratch)
The standard procurement pipeline starting from a material request:

```
Create Request → Pending Manager Approval
  ├─▶ Approved → [Click "Create CC"] → Cost Comparison created (min 2 vendor quotes)
  │     └─ Submitted → Manager Review (status: review_cc)
  │           ├─▶ Approved (vendor selected) → Purchase Order creation
  │           ├─▶ Queried → CC relisted in RFQ section for resubmission (revised rates/vendor), (Notes option if want to instruct something)
  │           └─▶ Rejected → CC closed; stored as rejected in filtered list(Notes option if want to instruct simething)
  │
  └─ [PO Created] → Submitted → Manager Review (status: review_po)
        ├─▶ Approved → Delivery Challan creation
        ├─▶ Queried → PO relisted for resubmission (Notes option if want to instruct simething)
        └─▶ Rejected → PO closed; items returned to prior state (Notes option if want to instruct simething)
```

**Data Auto-fill Rule**: Item details from RFQ are auto-carried into CC; CC vendor/item details are auto-carried into PO. No manual re-entry.

---

### Delivery Challan — Partial Delivery
- Procurement Officer can create a DC with a **partial quantity** (e.g., vendor has 50 of 100 units).
- Remaining unfulfilled quantity is stored in **Pending Purchase Orders** on the PO page.
- A new DC can be created for the remaining quantity when the vendor is ready.

---

### GRN (Goods Receipt Note) — Auto-Creation
- GRN is **not a form the user submits**. It is **automatically generated** when delivery is confirmed.
- Anyone (Site Supervisor, Site Engineer, Procurement Officer) can click **"Delivered"** to confirm receipt.
- Upon confirmation, the confirming user must **upload unloading photos**.
- Auto-filled GRN fields:
  - GRN Number | Vendor Name | Item Description | Quantity
  - PO/RFQ Creation Date | Delivery Date | Invoice Number (if available)
  - Delivery Challan photos | Confirming user identity
- GRN appears in the **Supply → GRN** section of the sidebar.

---

### Navigation Structure

#### Procurement Section (Sidebar)
1. **RFQ** — All Request for Quotations
2. **Purchase Orders** — POs in creation and approval stage
3. **Pending Purchase Orders** — Approved POs waiting for delivery or partially delivered
4. **Delivery** — All deliveries (partial or full)

#### Supply Section (Sidebar, collapsible)
- **Vendors** — Vendor master list
- **Inventory** — Stock levels on-site and in office
- **GRN** — Auto-generated goods receipt notes
- **Logs** — System activity log with reference ID links to every action

### No Hardcoded Colors
- All UI colors use CSS variables from the centralized theme system.
- Colors automatically adapt between light and dark modes.

---

## Technology Foundation

- **Framework**: Next.js (React, TypeScript, App Router)
- **Backend & Real-time DB**: Convex
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI primitives + custom component system
- **Forms**: React Hook Form + Zod validation
- **Auth**: JWT-based (or Clerk)
- **File Storage**: Cloudflare R2

---

## Design Philosophy

- **Clean & Corporate**: Structured, minimal visual noise. No decorative excess.
- **Centralized UI Components**: One universal form/document template adapts per document type.
- **Theme-aware Colors**: Blue + Yellow + White palette adapts between light/dark.
- **Medium Rounding**: Border radius of 6px across all components — structured, not pill-shaped.
- **Role-contextual UI**: The same page renders differently based on who is logged in.

---

## Data Scoping & Authorization Model

> **Added in Stage 1 (Sprint 2 hardening sprint).** These rules are enforced server-side in `convex/scoping.ts` and `convex/permissions.ts`. They are machine-checked by the test suite.

### Role Scoping Rules

| Role | Scope | Rule |
|---|---|---|
| **Admin** | Global | Unrestricted. Sees all projects, sites, documents. |
| **Project Manager** | Project-scoped | Full access to all sites under their `assignedProjectIds`. Additional `assignedSiteIds` extend (never narrow) access — e.g. to oversee a specific site in a different project. |
| **Procurement Officer** | Project-scoped | Same as Project Manager for read/write scope. Action permissions differ (submits → PM approves). |
| **Site Supervisor** | Site-scoped (strict) | Can ONLY see documents where `siteId` is in their `assignedSiteIds`. The parent `projectId` alone does NOT grant access. |

### Core Security Invariants

1. **Fail-Closed Rule**: If a non-admin user has zero `assignedProjectIds` and zero `assignedSiteIds`, they see **zero documents** and receive `Forbidden` on every direct ID lookup. There is no fallback to "show everything" or "show nothing silently" — the query returns an empty list and any direct mutation or ID lookup throws `Forbidden`.
2. **Site-Level Precedence**: For Site Supervisors, data access is strictly partitioned at the site level. Knowing the parent `projectId` never grants access to documents belonging to other sites under that project.
3. **PM Extend-Never-Narrow**: When a Project Manager or Procurement Officer is assigned to a project, `resolveCallerScope()` automatically queries all child sites under that project and merges them into `allowedSiteIds`. Assigning additional specific sites extends their access without narrowing project-level authority.
4. **Schema-Derived Index Capabilities (`SCHEMA_INDEX_CAPABILITIES`)**:
   Query scoping uses compile-time static capability mapping derived directly from `convex/schema.ts`. It prevents dynamic string typos, eliminates caller-supplied boolean flags, and leverages prefix indexing (e.g. querying `by_siteId_status` by `siteId` alone when `status` is omitted) to execute bounded range queries rather than collection-wide scans.
5. **IDOR Prevention**:
   Every mutation and query that accepts a document ID (MR, CC, PO, DC, GRN) calls `assertDocumentAccess(scope, doc)` before returning data. A user with a valid token who guesses a document ID from another project receives: `Forbidden: You do not have access to document "MR-2026-XXXX" in this project or site.`

---

## Cascade Permission Model

> **Added in Stage 1.** Cascade permissions are distinct from direct-action permissions. They represent the system automatically updating a parent document because a child-document action happened.

### Why Granular Cascade Keys Matter
When a Procurement Officer creates a PO against an MR (`purchase_orders:create_from_cc`), the system must advance the parent Material Request status to `review_po`. This is a cascade — the user is acting on a PO, not editing an MR directly. Using `material_requests:update` for this cascade would:
1. Allow the same permission to be used for direct edits (wrong role set — e.g. allowing procurement officer to directly rewrite MR specifications).
2. Flatten role boundaries and break Segregation of Duties.
3. Make audit logs unreadable ("user updated MR" gives no context about the triggering child document action).

### Ten Granular Cascade Action Keys

| Cascade Action | Trigger | Allowed Roles |
|---|---|---|
| `material_requests:review_on_cc` | CC created or resubmitted against an MR → MR moves to `review_cc` | `procurement_officer`, `project_manager`, `admin` |
| `material_requests:advance_on_cc_approval` | CC approved by PM → MR moves to `ready_for_po` | `project_manager`, `admin` |
| `material_requests:reset_on_cc_reject` | CC rejected → MR returns to `ready_for_cc` | `project_manager`, `admin` |
| `material_requests:review_on_po` | PO submitted or resubmitted against an MR → MR moves to `review_po` | `procurement_officer`, `project_manager`, `admin` |
| `material_requests:advance_on_po_approval` | PO approved by PM → MR moves to `pending_po` | `project_manager`, `admin` |
| `material_requests:reset_on_po_reject` | PO rejected or cancelled → MR returns to `ready_for_po` | `project_manager`, `admin` |
| `material_requests:close_on_short_close` | PO short-closed → MR moves to `delivered` | `project_manager`, `admin` |
| `material_requests:advance_on_dc` | DC created against PO → MR moves to `delivery_processing` | `procurement_officer`, `project_manager`, `admin` |
| `material_requests:close_on_receipt` | All GRN batches complete → MR moves to `delivered` | `site_supervisor`, `project_manager`, `admin` |
| `delivery_challans:deliver` | GRN confirmed → DC moves to `delivered` | `site_supervisor`, `procurement_officer`, `admin` |

### State Machine Invariant
Every document status change — whether user-initiated or cascade — routes through the `transition()` helper in `convex/transition.ts`. Direct `db.patch(id, { status: ... })` outside `transition.ts` is prohibited and enforced by the Gate 3 static scanner in `tests/transition_matrix.test.ts`.

---

## Plan v2: BOQ Commitment Accounting

> **Added in Stage 1.** Tracks the difference between committed and procured quantities on BOQ items.

### Two Counters per BOQ Item (`project_items`)

| Counter | Meaning | Changes When |
|---|---|---|
| `committedQty` | Quantity locked into an approved PO that has not yet been received | PO created (+qty), PO received (-qty), PO cancelled (-qty), PO short-closed (-remainder) |
| `procuredQty` | Quantity physically received on site (cumulative across all GRN batches) | GRN confirmed (+received qty) |

### Key Invariants
- `committedQty + procuredQty <= boqQty` at all times (over-delivery blocked at DC creation)
- On full PO cancellation: `committedQty` reduced by the full PO quantity; `procuredQty` unchanged
- On short-close: `procuredQty` keeps the partial amount already received; `committedQty` reduced by the unreceived remainder
- On 100% fulfilment across batches: PO auto-closes as `fully_received`, parent MR auto-transitions to `delivered`

---

*Last Updated: Stage 1 / Sprint 2 hardening (2026-08-31). Scoping and accounting models added.*
*This document is the source of truth for project scope decisions.*
