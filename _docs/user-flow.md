# User Flow

> Reference: `project-overview.md` for role definitions and module scope.

This document defines every user journey through the application — how different roles navigate, what they can do, and how features connect to one another.

---

## 1. Authentication Flow

```
Landing Page (/) 
  → Login Page (/login)
      ↓ [Valid credentials]
  → Role-based Dashboard Redirect
      ├── Site Supervisor  → /dashboard/site
      ├── Project Manager  → /dashboard/manager
      ├── Procurement Officer → /dashboard/procurement
      └── Admin           → /dashboard/admin
```

- No self-registration. Users are created by Admin only.
- JWT token stored in HTTP-only cookie. Session persists until logout or token expiry.
- Unauthorized route access redirects to `/login`.

---

## 2. Site Supervisor Flow

The Site Supervisor operates entirely from construction sites and interacts only with the request pipeline.

### 2.1 Dashboard (`/dashboard/site`)
- Views **own active requests** sorted by latest activity.
- Status badges show current state at a glance.
- Quick-access cards for: Active Requests, Deliveries Today.

### 2.2 Create Material Request
```
Dashboard → "New Request" Button
  → Universal Document Form (type: MATERIAL_REQUEST)
      [Fields: Project, Site, Category, Items + Qty, Notes, Priority]
  → Submit
      ↓ Status: draft → pending
  → Request appears in Manager's approval queue
```

### 2.3 Track Request Status
- Requests show real-time status badges.
- "Query" status means Manager sent it back with comments — Site Supervisor edits and resubmits.

### 2.4 Confirm Delivery (GRN)
```
Dashboard → "Out for Delivery" request
  → View Delivery Details
  → Click "Delivered" button
      ↓ GRN is automatically created and filled (no manual form)
      ↓ User is prompted to upload unloading photos
          ↓ Status: delivered
```

---

## 3. Project Manager Flow

Project Manager has the highest authority. They can approve, reject, or directly create any document without going through the request pipeline.

### 3.1 Dashboard (`/dashboard/manager`)
- Overview cards: Pending Approvals, Deliveries In Progress.
- Real-time feed of all recent activity across all sites.

### 3.2 Approve / Reject Material Request
```
Dashboard → Pending Requests list
  → Click Request → Request Detail View
      ├── [Approve] → Status: ready_for_cc (or Procurement Officer clicks "Create CC")
      ├── [Reject]  → Modal: Enter rejection reason → Status: rejected
      └── [Query] → Modal: Enter query notes → Status: queried (back to Site Supervisor)
```

### 3.3 Direct Document Creation (Manager Privilege)
```
Manager Dashboard → "Create New" Dropdown
  → Select document type: [RFQ | PO | CC | DC]
  → Universal Document Form (adapts fields per type)
  → Submit → IMMEDIATELY finalized (no approval step needed)
```

### 3.4 Review Cost Comparison
```
CC Review queue → Click CC → View vendor quotes side-by-side
  ├── [Approve] (select winning vendor) → Status: ready_for_po (vendor & rates locked for auto-filled PO)
  ├── [Query]   → CC relisted in RFQ section; Procurement Officer must resubmit with revised rates/vendor
  └── [Reject]  → CC closed permanently; stored in list as rejected (filterable)
```

### 3.5 Review Purchase Order
```
PO Review queue → Click PO → View line items and vendor
  ├── [Approve] → PO finalized; moves to Pending POs; Procurement Officer can create DC
  ├── [Query]   → PO relisted for resubmission
  └── [Reject]  → PO closed; items returned to prior state
```

---

## 4. Procurement Officer Flow

Procurement Officer handles all the purchasing mechanics. They operate as an executor — their submissions require Project Manager sign-off (unless the Manager creates directly).

### 4.1 Dashboard (`/dashboard/procurement`)
- Pipeline view: counts at each stage (RFQ, CC review, PO review, Pending PO, Delivery).
- Action queues: items requiring attention at each stage.

### 4.2 Path 1: Send to Procurement (from Project Item List)
```
Projects → Select Project → Item List (Tender/BOQ)
  → Select one or more items (checkbox on hover)
  → Click "Send to Procurement"
      ├── [RFQ]            → Item details auto-filled into new RFQ → Saved to RFQ page
      ├── [Purchase Order] → Select vendor → Item details auto-filled into new PO → Saved to PO page
      └── [Delivery]       → Item details auto-filled into new DC → Saved to Delivery page
```

### 4.3 Path 2: Default Flow (RFQ → CC → PO → DC)
```
Step 1 — Create RFQ:
RFQ page → Select approved request items
  → Universal Document Form (type: RFQ)
  → Send to vendor via WhatsApp / Email button (redirects to WhatsApp with pre-filled message)
  → After quotes received, click "Create CC" on RFQ list

Step 2 — Create CC:
  → Universal Document Form (type: COST_COMPARISON)
  → Vendor quotes are auto-filled from RFQ; add/edit price, tax, delivery terms
  → Minimum 2 vendor quotes required
  → Submit → Status: review_cc (Manager review pending)

Step 3 — Create PO (after CC approved):
  → Universal Document Form (type: PURCHASE_ORDER)
  → Selected Vendor, Line Items, Quantities, and Negotiated Rates are 100% AUTO-FILLED from approved CC
  → User does NOT manually select vendor or re-type items (zero manual entry)
  → PDF auto-generated on creation
  → Submit → Status: review_po (Manager review pending)

Step 4 — Create Delivery Challan (after PO approved):
  → Universal Document Form (type: DELIVERY_CHALLAN)
  → Fields: Vehicle number, Driver name, Items dispatched (can be partial qty), Expected arrival
  → Submit → Status: delivery_processing (Site sees "Out for Delivery")
  → If partial qty → Remaining qty stays in Pending Purchase Orders
```

### 4.4 Vendor Management
```
Supply → "Vendors"
  → Vendor list with search/filter
  → Add Vendor → Form: Name (uniqueness check), Contact, GST, Address, Category
  → Edit / Deactivate vendor
```

---

## 5. Admin Flow

### 5.1 User Management
```
Admin Dashboard → "Users"
  → Create new user: Name, Email, Role, Assigned Site/Project
  → Edit user / deactivate
  → Reset password
```

### 5.2 System Configuration
- Site/Project management
- Role permission adjustments
- System-wide settings

---

## 6. Cross-Role Shared Features

### 6.1 Chat (Real-time Messaging)
- **Site Supervisor** ↔ Project Manager and Procurement Officer
- **Procurement Officer** ↔ Site Engineer, Project Manager and other Procurement Officers
- **Project Manager** ↔ Everyone
- Chat icon in header shows unread badge.
- Messages are role-gated — Site Supervisors cannot chat with each other.

### 6.2 Notifications
- In-app toast notifications for: new messages, status changes, approvals/rejections.
- Header notification bell for unread system events.

### 6.3 Theme Toggle
- Light / Dark mode toggle available in user profile / header.
- Theme preference is persisted per user.

---

## 7. Universal Document Form — Shared Navigation Pattern

All document types (Material Request, RFQ, CC, PO, DC, GRN) use the **same UI shell**:

```
┌─────────────────────────────────────────┐
│  [Back]    Document Title    [Actions]  │  ← Universal Header
├─────────────────────────────────────────┤
│  Status Badge | Created By | Date       │  ← Meta Row
├─────────────────────────────────────────┤
│                                         │
│     [Adaptive Fields Section]           │  ← Changes per document type
│     (Items table, quotes, etc.)         │
│                                         │
├─────────────────────────────────────────┤
│  Notes / Comments Section               │  ← Always present
├─────────────────────────────────────────┤
│  [Cancel]              [Submit / Save]  │  ← Universal Footer Actions
└─────────────────────────────────────────┘
```

---

## 8. Full Status Workflow Map

### Path 1: Project Item Routing
```
Project Item List → Select Items → "Send to Procurement"
  ├─▶ [RFQ]        → RFQ created (auto-filled) → → Create CC → review_cc → ... (continues as default)
  ├─▶ [PO]         → PO created (auto-filled, vendor selected) → review_po → Approved → DC → delivery_processing → delivered
  └─▶ [Delivery]   → DC created directly → delivery_processing → delivered
```

### Path 2: Default Request Flow
```
draft
  ├─▶ pending                      [If "Require Manager Approval" is ON]
  │     ├─▶ queried                [Manager sends back with notes]
  │     │     └─▶ pending          [Supervisor/Officer resubmits]
  │     ├─▶ rejected               [Manager rejects]
  │     └─▶ ready_for_cc           [Manager approves; "Create CC" button appears]
  │
  └─▶ ready_for_cc                 [If "Require Manager Approval" is OFF: Bypasses manager approval]
              └─▶ review_cc         [Purchase Officer submits CC; awaiting Manager]
                    ├─▶ Queried    [Manager queries; CC back to RFQ list for revision]
                    ├─▶ rejected   [Manager rejects CC; CC stored as rejected]
                    └─▶ ready_for_po  [Manager approves CC; vendor selected]
                          └─▶ review_po   [Purchase Officer creates PO; awaiting Manager]
                                ├─▶ Queried       [Manager queries; PO relisted for revision]
                                ├─▶ rejected      [Manager rejects PO; items back to prior state]
                                └─▶ pending_po    [Manager approves PO]
                                      └─▶ delivery_processing  [DC created; partial or full qty]
                                            └─▶ delivered           ["Delivered" clicked; GRN auto-created]

Partial Delivery:
  delivery_processing (partial) → remaining qty stays in Pending Purchase Orders
                                → new DC created for remainder when vendor is ready
```

### Data Auto-Fill Chain
```
RFQ items → auto-filled into CC → CC details auto-filled into PO → PO details auto-filled into DC
```

---

*Last Updated: Auto-maintained by AI agent.*
*This document must be updated whenever a new feature or role action is added.*
