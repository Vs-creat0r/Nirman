# Project Rules

> Reference: All other `_docs/` files.
>
> This document defines code organization, naming conventions, file structure, and behavioral rules for the AI agent.
> **This file is the source of truth for all code organization decisions.**

---

## 1. AI Agent Behavior Rules

### 1.1 Document-First Principle
- **Before writing any code**, the AI agent must read the relevant `_docs/` files.
- When the user gives an instruction, the agent must:
  1. Identify which modules/roles are affected.
  2. Update the relevant `.md` file in `_docs/` if any rule or behavior is changing.
  3. Then write/modify the code.

### 1.2 Auto-Update Documentation
- Whenever a new feature is added, a bug is fixed with a behavioral change, or a new component pattern is established:
  - The AI agent **must update the relevant `_docs/` file** — without being told to.
  - This keeps documentation always in sync with code.

### 1.3 Role Logic — No Assumptions
- Never assume what a role can or cannot do.
- Always check `user-flow.md` and `project-overview.md` for role permissions before writing role-gated logic.
- The rule is:
  - **Project Manager creates → auto-finalized** (no approval needed)
  - **Procurement Officer creates → goes to Project Manager for approval**
  - **Site Supervisor creates requests only** — they cannot create procurement documents
  - **Segregation of Duties on Goods Receipt (Option A)**: The role that approves commercial Purchase Orders (`project_manager`) is strictly barred from confirming goods receipt (`grn:create`, `purchase_orders:close_on_receipt`). Goods receipt must be certified on-site by `site_supervisor`, coordinated by `procurement_officer`, or authorized by `admin`.

### 1.4 Do Not Invent UI Patterns
- Always use the patterns defined in `ui-rules.md`.
- If a new pattern is needed, propose it explicitly and update `ui-rules.md` before implementing.

---

## 2. Directory Structure

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/              # Protected route group
│   │   ├── layout.tsx            # Dashboard layout (sidebar + header)
│   │   ├── site/                 # Site Supervisor views
│   │   │   ├── page.tsx          # Dashboard
│   │   │   └── requests/
│   │   │       ├── page.tsx      # My requests list
│   │   │       └── [id]/page.tsx # Request detail
│   │   ├── manager/              # Project Manager views
│   │   │   ├── page.tsx
│   │   │   └── approvals/
│   │   │       └── page.tsx
│   │   ├── procurement/          # Procurement Officer views
│   │   │   ├── page.tsx
│   │   │   ├── rfqs/
│   │   │   ├── cost-comparison/
│   │   │   ├── purchase-orders/
│   │   │   ├── pending-purchase-orders/
│   │   │   └── delivery-challan/
│   │   ├── vendors/              # Vendor Management (all procurement roles)
│   │   │   └── page.tsx
│   │   ├── inventory/            # Inventory Management (Phase 2)
│   │   │   └── page.tsx
│   │   ├── chat/                 # Chat (all roles)
│   │   │   └── page.tsx
│   │   └── admin/                # Admin views
│   │       └── users/
│   └── api/                      # API route handlers
│       └── webhooks/
│
├── components/
│   ├── ui/                       # Base design system components (Button, Input, Badge, etc.)
│   ├── document/                 # Universal Document Form components
│   │   ├── document-form.tsx     # Main smart form shell
│   │   ├── document-header.tsx
│   │   ├── document-meta.tsx
│   │   ├── document-footer.tsx
│   │   ├── document-notes.tsx
│   │   └── bodies/               # Per-type body components
│   │       ├── material-request-body.tsx
│   │       ├── rfq-body.tsx
│   │       ├── cost-comparison-body.tsx
│   │       ├── purchase-order-body.tsx
│   │       ├── delivery-challan-body.tsx
│   │       └── grn-body.tsx
│   ├── layout/                   # Sidebar, Header, Navigation
│   ├── dashboard/                # Dashboard-specific widgets (summary cards, feeds)
│   ├── vendors/                  # Vendor management components
│   ├── chat/                     # Chat components
│   └── shared/                   # Truly shared across features (StatusBadge, DateDisplay, etc.)
│
├── convex/
│   ├── schema.ts                 # Database schema (ALL tables defined here)
│   ├── requests.ts               # Material request mutations + queries
│   ├── purchaseOrders.ts         # Purchase order logic
│   ├── costComparisons.ts        # CC logic
│   ├── rfqs.ts                   # RFQ logic
│   ├── deliveryChallans.ts       # DC logic
│   ├── grn.ts                    # GRN logic
│   ├── vendors.ts                # Vendor CRUD
│   ├── users.ts                  # User management
│   ├── chat.ts                   # Chat messages + conversations
│   ├── presence.ts               # Online/offline tracking
│   └── inventory.ts              # Inventory (Phase 2)
│
├── hooks/
│   ├── use-document-form.ts      # Universal form logic hook
│   ├── use-role.ts               # Current user role hook
│   ├── use-chat.ts
│   ├── use-presence.ts
│   └── use-pwa.ts
│
├── lib/
│   ├── schemas/                  # Zod validation schemas by domain
│   │   ├── request.schema.ts
│   │   ├── rfq.schema.ts
│   │   ├── po.schema.ts
│   │   ├── cc.schema.ts
│   │   ├── dc.schema.ts
│   │   └── vendor.schema.ts
│   ├── theme.ts                  # Brand theme switcher
│   ├── auth.ts                   # JWT helpers
│   ├── pdf.ts                    # PDF generation utilities
│   ├── excel.ts                  # Excel export utilities
│   └── utils.ts                  # General utilities (cn, formatDate, etc.)
│
├── types/
│   ├── roles.ts                  # Role types + permissions
│   ├── document.ts               # DocumentType, DocumentStatus, etc.
│   └── convex.d.ts               # Extended Convex types
│
├── styles/
│   ├── globals.css               # Base Tailwind setup
│   └── themes.css                # All CSS variable definitions (light + dark, per brand)
│
└── _docs/                        # THIS FOLDER — project documentation
    ├── project-overview.md
    ├── user-flow.md
    ├── tech-stack.md
    ├── ui-rules.md
    ├── theme-rules.md
    ├── project-rules.md          # This file
    └── phases/
        ├── phase-1-setup.md
        ├── phase-2-mvp.md
        └── phase-3-enhancements.md
```

---

## 3. File Naming Conventions

| Item | Convention | Example |
|---|---|---|
| React components | `kebab-case.tsx` | `document-form.tsx` |
| Page files | `page.tsx` (fixed by Next.js) | `page.tsx` |
| Layout files | `layout.tsx` (fixed) | `layout.tsx` |
| Hooks | `use-{name}.ts` | `use-document-form.ts` |
| Convex backend | `camelCase.ts` (domain name) | `purchaseOrders.ts` |
| Zod schemas | `{domain}.schema.ts` | `rfq.schema.ts` |
| Type files | `{domain}.ts` | `document.ts` |
| Utility files | `{name}.ts` | `utils.ts`, `pdf.ts` |
| CSS files | `kebab-case.css` | `globals.css`, `themes.css` |

---

## 4. Code Conventions

### 4.1 File Header (Required on Every File)
Every file must start with a `@fileoverview` comment:

```typescript
/**
 * @fileoverview Document Form — Universal smart form shell component.
 * Renders as Material Request, RFQ, Cost Comparison, PO, DC, or GRN
 * based on the `type` prop. Role-gated actions are computed here.
 *
 * @module components/document/document-form
 */
```

### 4.2 Function Documentation (Required)
Every exported function must have a JSDoc block:

```typescript
/**
 * @description Computes visible action buttons based on document type and user role.
 * Returns an array of action configs — each with a label, handler, and visibility flag.
 *
 * @param documentType - The type of document being rendered
 * @param userRole - The authenticated user's role
 * @param currentStatus - Current status of the document
 * @returns Array of action button configurations
 */
function getDocumentActions(
  documentType: DocumentType,
  userRole: UserRole,
  currentStatus: DocumentStatus
): ActionConfig[] { ... }
```

### 4.3 Component Pattern
```typescript
"use client"; // Only if needed — server components are preferred

/**
 * @fileoverview ... (file header)
 */

// 1. External imports
import { useState } from "react";
import { useQuery } from "convex/react";

// 2. Internal imports (aliased — never relative ../../)
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

// 3. Types
interface ComponentProps {
  id: string;
  mode: "view" | "edit";
}

// 4. Component
/**
 * @description (component description)
 */
export function ComponentName({ id, mode }: ComponentProps) {
  // Logic
  return <div>...</div>;
}
```

### 4.4 Import Order
1. React + next
2. Third-party libraries
3. `@/components/ui/`
4. `@/components/` (feature components)
5. `@/lib/`, `@/hooks/`, `@/types/`
6. Convex API

### 4.5 Absolutely Prohibited
- ❌ `any` type — always type properly
- ❌ Hardcoded color values anywhere in component files
- ❌ `console.log` left in production code
- ❌ Files over 500 lines
- ❌ Relative imports (`../../`) — use `@/` alias always
- ❌ Empty catch blocks — always handle errors meaningfully
- ❌ Magic strings — use typed constants or enums

---

## 5. State Management Rules

- **Server state**: Always Convex `useQuery` / `useMutation` — never fetch from API routes for data that lives in Convex.
- **Form state**: React Hook Form — no manual `useState` for form fields.
- **UI state**: `useState` / `useReducer` — scoped to the component.
- **Global UI state** (modal open, sidebar collapse): React Context — keep context minimal.
- **No Redux, Zustand, or Jotai** unless a clear case is made and this document is updated.

---

## 6. Error Handling Rules

### In Convex Mutations
```typescript
// Throw explicit errors — never return null for failures
if (!vendor) throw new Error("Vendor not found");
if (duplicate) throw new ConvexError("DUPLICATE_VENDOR_NAME");
```

### In Components
```typescript
// Always handle mutation errors with toast notifications
const mutation = useMutation(api.vendors.create);

async function handleSubmit(data: VendorForm) {
  try {
    await mutation(data);
    toast.success("Vendor created successfully");
  } catch (error) {
    toast.error("Failed to create vendor. Please try again.");
  }
}
```

---

## 7. Uniqueness Checks (UI + Backend)

### Rule: Duplicate names must be prevented at BOTH levels
1. **Backend (Convex mutation)**: Query for existing record before inserting. Throw error if duplicate found.
2. **Frontend (form)**: Show inline error message — do not wait for server error.

### Example: Vendor name uniqueness
```typescript
// convex/vendors.ts
export const createVendor = mutation({
  handler: async (ctx, { name, ...rest }) => {
    const existing = await ctx.db
      .query("vendors")
      .filter(q => q.eq(q.field("name"), name))
      .first();
    if (existing) throw new ConvexError("VENDOR_NAME_EXISTS");
    // ... proceed with creation
  }
});
```

---

## 8. Dropdown Sorting Rule (Selection Lists)

When a selection dropdown contains items that have already been selected or added:
- **Already added/selected items** are grouped **at the top** under a distinct heading (e.g., "✓ Already Added").
- **Available items** are listed below under a heading (e.g., "Available Vendors").
- Never mix already-added items randomly with available options.

---

## 9. Testing Philosophy

- Unit test all Zod schema validations.
- Unit test all utility functions in `lib/`.
- Integration test critical Convex mutations (create request, approve request, create PO).
- E2E test the full happy path: create request → approve → CC → PO → deliver → GRN.

---

*Last Updated: Auto-maintained by AI agent.*
*This file must be updated whenever a new architectural pattern is established.*
