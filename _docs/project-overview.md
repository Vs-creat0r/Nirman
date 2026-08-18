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

*Last Updated: Auto-maintained by AI agent based on project instructions.*
*This document is the source of truth for project scope decisions.*
