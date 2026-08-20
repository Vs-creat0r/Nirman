# Smart Inputs & Centralized Data Rules

> Reference: `ui-rules.md`, `project-overview.md`
>
> This document defines the behavior for smart autocomplete, inventory suggestions, and centralized data selection across all Universal Document Forms in the system.

---

## 1. Centralized Inventory Suggestions
- **Smart Autocomplete**: Whenever a user clicks "Add Item" on any form (Material Request, PO, DC, etc.) and begins typing an item name, the input field must **smartly suggest items** fetched from the global inventory database.
- **Goal**: Prevent duplicate item entries with slight spelling variations (e.g., "Cement 50kg" vs "Cement 50 kg") and speed up data entry.

## 2. Centralized Vendor Selection
- **Global Vendor List**: Whenever a form requires a vendor (CC, PO, RFQ), the input must automatically fetch from the central vendors list.
- **Smart Suggestion**: As the user types, it should filter and suggest matching vendors. The user should not need to leave the form to look up vendor details.

## 3. RFQ-Specific Item Entry Workflow
The Request for Quotation (RFQ) form has a highly specialized, context-aware item entry workflow:

1. **Mandatory Project Selection**: 
   - The user *must* select a Project before entering any items.
2. **Project-Scoped Suggestions**: 
   - When entering an item, the autocomplete must first prioritize suggesting **items that have already been added to that specific project**.
3. **Global Inventory Fallback**: 
   - If the item is not found within the project's current item list, the UI must provide a clear button/option: **"Show from Inventory"**. This allows the user to browse and pull from the global inventory list. When submitting an item that isn’t already in the project, display a confirmation pop‑up asking whether to add the item to the project selected by the user.
4. **Automatic Synchronization (New Items)**: 
   - If the user types a completely new item that exists neither in the project nor in the global inventory, and submits it, **that item must be automatically added to the selected project**. 
   - This ensures a synchronized, growing list of items uniquely associated with that project for future use.

---

## 4. Document-to-Document Auto-Fill Chain (The Golden Rule)

> **Principle:** Every field that can be derived from a previously approved document MUST be auto-filled. The user should never re-type data that the system already knows.

### 4.1 The Complete Auto-Fill Chain

```
RFQ (items + vendors selected)
  │
  ▼ [Procurement Officer clicks "Create CC" on approved RFQ]
Cost Comparison
  → Items auto-filled from RFQ
  → Vendor options pre-populated from vendors on that RFQ
  → Procurement Officer adds unit prices, tax %, delivery terms per vendor
  │
  ▼ [Manager reviews CC, selects ONE vendor, clicks Approve]
  → Status: ready_for_po
  → selectedVendorId is now set on the CC record
  │
  ▼ [Procurement Officer clicks "Create PO" on approved CC]
Purchase Order
  → ccId:      auto-filled (locked, read-only — the CC this PO originated from)
  → vendorId:  auto-filled from CC.selectedVendorId (THE MANAGER'S VENDOR CHOICE — locked)
  → lineItems: auto-filled from CC items with agreed rates (unit, qty, unitPrice)
  → User sees these fields as READONLY badges / display text — NOT editable dropdowns
  │
  ▼ [Manager approves PO]
  → Status: pending_po
  │
  ▼ [Procurement Officer clicks "Create DC" on approved PO]
Delivery Challan
  → poId:             auto-filled (locked)
  → dispatchedItems:  auto-filled from PO line items (user can adjust qty for partial delivery)
  → vendorId context: visible in DC header (carried from PO)
  → User fills ONLY: vehicleNo, driverName, isPartial toggle, expectedArrival
  │
  ▼ [Site Supervisor clicks "Delivered"]
GRN (Goods Receipt Note) — FULLY AUTO-GENERATED, no manual form
  → poId:          copied from DC.poId
  → dcId:          linked to this DC
  → receivedItems: copied from DC.dispatchedItems
  → confirmedBy:   set to current logged-in user
  → confirmedAt:   set to current timestamp
  → User is only prompted to: upload unloading photos
```

### 4.2 Field-Level Auto-Fill Rules Per Document

#### Cost Comparison (CC) — created from RFQ
| Field | Source | Editable by User? |
|---|---|---|
| `rfqId` | The RFQ it was created from | ❌ Locked (readonly) |
| `vendorQuotes[].vendorId` | Pre-populated from RFQ vendor list | ✅ User adds/edits prices |
| `vendorQuotes[].unitPrice` | Blank — user enters quotes received | ✅ User fills |
| `vendorQuotes[].taxRate` | Blank | ✅ User fills |
| `status` | Always starts as `draft` | ❌ System-managed |

#### Purchase Order (PO) — created from approved CC
| Field | Source | Editable by User? |
|---|---|---|
| `ccId` | The CC it was created from | ❌ Locked (readonly badge) |
| `vendorId` | `CC.selectedVendorId` (Manager's approved choice) | ❌ Locked — NEVER editable at PO stage |
| `lineItems[].itemName` | From CC → RFQ items | ❌ Locked |
| `lineItems[].quantity` | From CC → RFQ items | ❌ Locked |
| `lineItems[].unit` | From CC → RFQ items | ❌ Locked |
| `lineItems[].unitPrice` | From CC vendor quote (selected vendor's rate) | ✅ Editable (price may be renegotiated) |
| `paymentTerms` | Blank | ✅ User fills |
| `sourcePath` | `from_request` (auto-set) | ❌ System-managed |
| `status` | Always starts as `draft` | ❌ System-managed |

#### Delivery Challan (DC) — created from approved PO
| Field | Source | Editable by User? |
|---|---|---|
| `poId` | The PO it was created from | ❌ Locked (readonly badge) |
| `siteId` | Auto-filled from MR.site (if available) | ✅ Editable |
| `dispatchedItems` | Copied from PO.lineItems | ✅ Qty can be reduced (partial delivery) |
| `vehicleNo` | Blank | ✅ User fills |
| `driverName` | Blank | ✅ User fills |
| `expectedArrival` | Blank | ✅ User fills |
| `isPartial` | Defaults to `false` | ✅ Toggle |
| `sourcePath` | `from_po` (auto-set) | ❌ System-managed |

#### GRN — auto-created on "Delivered" click
| Field | Source | Editable by User? |
|---|---|---|
| `poId` | From DC.poId | ❌ Locked |
| `dcId` | This DC | ❌ Locked |
| `receivedItems` | Copied from DC.dispatchedItems | ❌ Locked |
| `confirmedBy` | Current user identity | ❌ System-set |
| `confirmedAt` | Server timestamp | ❌ System-set |
| `photos` | Blank | ✅ User uploads (prompted immediately) |
| `invoiceNumber` | Blank | ✅ Optional user input |

### 4.3 The Manager's Vendor Selection — Critical Rule

> **This is the most important auto-fill rule in the entire system.**

When a Project Manager opens a Cost Comparison and clicks **Approve**:
1. They MUST select a vendor from `selectedVendorId` before the approve action is enabled.
2. The Approve button is **disabled** until a vendor is selected from the CC's vendor quotes list.
3. On approval, `CC.selectedVendorId` is saved and `CC.status → ready_for_po`.
4. When the Procurement Officer creates a PO from this CC, `vendorId` is auto-filled from `CC.selectedVendorId` and rendered as a **read-only display** (not a dropdown).
5. The Procurement Officer has **zero ability** to change the vendor at the PO stage — it is the Manager's decision and is final.

### 4.4 Direct PO Path (No CC) — Vendor Selection
When a PO is created directly (Manager privilege or direct Project Item routing):
- `vendorId` field IS shown as an editable autocomplete (because no CC exists to derive it from).
- `ccId` is blank / null.
- `sourcePath` is set to `direct_po`.

### 4.5 Developer Implementation Note

All auto-fill logic must be implemented server-side in the Convex mutation that creates each document — **never trust the client to pass auto-fill values**. The mutation must:
1. Accept the source document's ID as input (e.g., `ccId` when creating a PO).
2. Fetch the source document from the database inside the mutation.
3. Snapshot all required fields from the source into the new document at creation time.
4. **Snapshot, do not live-join.** Store copies of the values, not references to mutable parent fields. This prevents retroactive changes to approved documents if a source document is later queried or edited.

---

## 🔗 Connected Nodes
- [[project-overview]]
- [[ui-rules]]
- [[user-flow]]
- [[Brain Home]]
