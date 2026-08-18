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
## 🔗 Connected Nodes
- [[project-overview]]
- [[ui-rules]]
- [[Brain Home]]
