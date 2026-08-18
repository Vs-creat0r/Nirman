# Phase 3 — Frontend, Theming & UI/UX

> **Goal:** Build the full themed UI shell and component library for the platform, with the **Universal Document Form** (per `agent-rules.md`/`ui-rules.md`) driven by your JSON contracts. At the end of this phase the app *looks and feels* production-grade — running on **mock data** that matches the contracts (real wiring happens in Phase 4).
>
> **Read first:** `_docs/ui-rules.md`, `_docs/theme-rules.md`, `_docs/project-rules.md`, `_docs/user-flow.md`, `_docs/smart-inputs-rules.md`, `_docs/stitch-design-brief.md`.
>
> **Prerequisites:** Phase 1 + 2 complete. `contracts/` exists, Convex connected, auth scaffold present.

---

## Deliverables

At the end of this phase:

- Two-layer theme system (light/dark + brand) per `theme-rules.md`, with **zero hardcoded colors**.
- A role-aware dashboard shell: sidebar + header per role (Site Supervisor, Project Manager, Procurement Officer, Admin).
- The **Universal Document Form** (`DocumentForm`) component — one form shell that renders any document type from its JSON contract.
- A component library: Button, Input, Select, Badge, Table, Card, Dialog, Toast, EmptyState, Skeleton, Avatar, Autocomplete.
- Status badges rendered from each contract's `statuses`.
- Themed screens for: login, each role's dashboard, and at least one full document flow — all on **mock data**.

---

## Why Mock Data First

You build the UI against mock data so you can perfect **look, layout, interactions, and responsiveness** without backend coupling. Because the mock data follows the contracts exactly, Phase 4's swap to live Convex data is near-mechanical — the components won't change shape, only the data source.

---

## Task 1 — Theme system

1. Create `styles/globals.css` with Tailwind v4 base.

2. Create `styles/themes.css` with **every CSS variable from `theme-rules.md`** (both light & dark, brand theme). Example start:

   ```css
   @import "tailwindcss";

   :root, .light {
     --background: #F8FAFC;
     --surface: #FFFFFF;
     --surface-elevated: #F1F5F9;
     --primary: #0F172A;
     --primary-hover: #1E293B;
     --accent: #D97706;
     --muted-text: #64748B;
     --border: #E2E8F0;
     --destructive: #DC2626;
     --success: #16A34A;
   }
   .dark { /* overrides from theme-rules.md */ }
   .theme-brand { /* brand overrides */ }
   ```

3. Install & wrap the app with `next-themes` (create `components/theme-provider.tsx`):

   ```tsx
   "use client";
   import { ThemeProvider as NextThemes } from "next-themes";
   export function ThemeProvider({ children }: { children: React.ReactNode }) {
     return <NextThemes attribute="class" defaultTheme="light" enableSystem>{children}</NextThemes>;
   }
   ```

4. Add `lib/theme.ts` with `initializeTheme()` / `setBrandTheme()` helpers that set `html` classes: `<html class="light theme-brand">` / `<html class="dark theme-brand">`.

### Verification — Task 1
- [ ] Toggling light/dark changes background + surface colors.
- [ ] `grep -rn "#[0-9a-fA-F]" app components lib` returns **nothing** — no hardcoded hex anywhere.
- [ ] The app renders in both modes without layout shift.

---

## Task 2 — Component library

Build a `components/ui/` set. Use **Radix primitives** under the hood per `tech-stack.md`, styled with theme variables. Match `stitch-design-brief.md` radii (6px inputs/buttons/cards, 8px modals, 4px badges — **never** `rounded-xl`/`rounded-2xl`).

| Component | Radix base | Notes |
|-----------|-----------|-------|
| `Button` | Radix Slot | variants: primary, secondary, outline, ghost, destructive; sizes sm/md/lg |
| `Input` | — | standard text/number/date inputs |
| `Textarea` | — | multiline |
| `Select` | `@radix-ui/react-select` | for single enum/reference selects |
| `MultiSelect` | `@radix-ui/react-select` | for array fields |
| `Autocomplete` | `@radix-ui/react-popover` | used by item/vendor smart suggestions (smart-inputs-rules) |
| `Badge` | — | status badge, tone from status (see Task 4) |
| `Table` | — | sortable columns, empty state |
| `Card` | — | panel wrapper |
| `Dialog` | `@radix-ui/react-dialog` | modals |
| `Toast` | `@radix-ui/react-toast` | success/error/query feedback |
| `EmptyState` | — | guidance per ui-rules (invitation to act) |
| `Skeleton` | — | loading placeholders |
| `Avatar` | — | initials avatar |

### Design rules (non-negotiable, from `ui-rules.md`)
- Corporate, not decorative: no gradients, no glows, no heavy shadows.
- Status-first: badges are prominent, always text + color (never color alone).
- Role-contextual rendering: only render buttons/actions the current role can use.

### Verification — Task 2
- [ ] Each component in the table exists under `components/ui/`.
- [ ] Every component uses CSS variables (no hex).
- [ ] A Storybook-style page or `components/ui/index.tsx` showcase renders all of them.

---

## Task 3 — Layout shell & role-aware navigation

1. Create `app/(dashboard)/layout.tsx` — sidebar (240px) + header (64px) + main content per `ui-rules.md` §2.

2. Create `components/layout/sidebar.tsx` — role-aware nav links:

   | Role | Links |
   |------|-------|
   | Site Supervisor | Dashboard, My Requests, New Request, Deliveries, Inventory |
   | Project Manager | Dashboard, Approvals, Projects, Vendors |
   | Procurement Officer | Dashboard, RFQs, Cost Comparisons, POs, DCs, Vendors, Inventory |
   | Admin | Dashboard, Users, Projects, Sites, Vendors, Logs, Settings |

3. Create `components/layout/header.tsx` — user menu (name, role), theme toggle, notification bell placeholder (Phase 5).

4. Create the four dashboards (`app/(dashboard)/site/page.tsx`, `/manager`, `/procurement`, `/admin`) per `user-flow.md` — each with stat cards and recent-activity list, **on mock data**.

### Verification — Task 3
- [ ] Navigating to `/dashboard/site` renders only the Site Supervisor's links.
- [ ] A role that shouldn't see a link cannot reach it (nav + redirect).
- [ ] Sidebar collapses/responsive on mobile.

---

## Task 4 — Status badge system

1. Create `lib/status.ts` mapping status → tone, using **theme variables**:

   ```ts
   // lib/status.ts
   export const statusTone: Record<string, string> = {
     draft: "muted",
     pending: "warning",
     approved: "success",
     rejected: "destructive",
     queried: "warning",
     out_for_delivery: "info",
     delivered: "success",
   };
   export const statusLabel = (status: string) => status.replace(/_/g, " ");
   ```

2. Create `components/status-badge.tsx`:

   ```tsx
   export function StatusBadge({ status }: { status: string }) {
     return <Badge tone={statusTone[status] ?? "muted"}><span>{statusLabel(status)}</span></Badge>;
   }
   ```

3. Every list/detail view uses `StatusBadge` — this is the primary status communication device per `ui-rules.md`.

### Verification — Task 4
- [ ] All statuses in your contracts have a tone mapping (no `?? "muted"` fallbacks silently hiding bugs — actually assert them).
- [ ] Badge shows both text and color.

---

## Task 5 — Universal Document Form (`DocumentForm`)

This is the **centerpiece** — one component that renders *any* document from its JSON contract. Per `agent-rules.md`: never build separate layouts for RFQ, PO, DC, CC, GRN, Material Request.

### 5.1 Design

```tsx
// components/document-form.tsx
export function DocumentForm({
  contract,        // the JSON contract (material_request.json, rfq.json, ...)
  initialData,     // optional prefilled values
  onSubmit,        // callback with collected values
  role,            // current user's role
}: Props) {
  // 1. Read contract.fields → build a React Hook Form + Zod schema (Phase 3: read zod or build per field).
  // 2. Map each field's `input` to a component:
  //      text → Input, select/enum → Select, reference → Select (options from relation table),
  //      autocomplete → Autocomplete (optionsFrom), item-list → editable rows, textarea → Textarea,
  //      readonly-badge → StatusBadge, number → Input type=number.
  // 3. Respect `conditional` — hide fields based on others.
  // 4. Respect `required` — block submit with inline errors.
  // 5. Call `onSubmit` with a plain object shaped exactly like the contract.
}
```

### 5.2 Form validation

Use **Zod** + `react-hook-form` per `tech-stack.md`. Build the Zod schema from the contract's `validation` rules:

```ts
// lib/build-zod.ts
import { z } from "zod";
export function zodFromContract(contract): z.ZodObject<any> {
  // for each field: z.string().min(maxLength) / z.number().min(min) / z.array(...) / z.enum(enum)
}
```

This keeps validation **derived from the contract** — one source, no drift.

### 5.3 Smart inputs (from `smart-inputs-rules.md`)

- **Item autocomplete:** on "Add Item", suggest from global inventory (mock in Phase 3), fallback "Show from Inventory" button.
- **RFQ-specific:** project must be selected first; suggestions prioritize project-scoped items.
- **Vendor autocomplete:** pulls from central vendor list.

### Verification — Task 5
- [ ] One `DocumentForm` renders Material Request, RFQ, PO, DC, CC, GRN — same shell, different fields.
- [ ] Required fields block submission with clear inline errors.
- [ ] Conditional fields appear/disappear correctly.
- [ ] The `onSubmit` value is a plain object matching the contract shape (type-check against the contract-derived TypeScript type if you generate one).

---

## Task 6 — Mock data layer

Create `lib/mock/` with one file per domain that returns **contract-shaped data**:

```ts
// lib/mock/requests.ts
import materialRequestContract from "../../contracts/material_request.json";

export const mockRequests = [
  {
    _id: "req_1",
    site: "site_1", project: "proj_1",
    items: [{ itemName: "Cement 50kg", quantity: 100, unit: "bags" }],
    notes: "For slab pouring",
    priority: "high",
    status: "pending",
    createdBy: "user_2",
    _creationTime: 1720000000000,
  },
  // ... more, each field matching the contract
];
```

Use the contract's field list to build these — that guarantees the mock shape and the future live shape are identical.

### Verification — Task 6
- [ ] Each mock list has at least 3–5 realistic entries.
- [ ] Mock data covers every status in the contract (so every badge color is exercised).
- [ ] The DocumentForm prefilled with mock data renders correctly.

---

## Task 7 — Assemble the demo flow

Wire the mock data into at least one **complete journey** so you can see the product feel:

1. Site Supervisor: dashboard → New Request (DocumentForm) → list shows new request with status `draft`.
2. Manager: approvals queue → approve → status becomes `approved`.
3. Procurement Officer: create RFQ → CC → select vendor → PO → DC → mark delivered → GRN appears.

### Verification — Task 7
- [ ] The full journey is clickable without any backend call (all state in `useState` / local store).
- [ ] Status badges update when state changes.
- [ ] The screens look complete and professional — walk through `ui-rules.md` checklist once more.

---

## Security checklist (Phase 3)

- [ ] **No secrets** in client code: no API keys, no `JWT_SECRET`, no prod URLs in `app/`, `components/`, `lib/` (only in `.env.local`, server-only).
- [ ] **Auth-aware routing scaffold:** `app/(auth)` vs `app/(dashboard)` route groups; a placeholder middleware ensures `/dashboard/*` is protected (full logic in Phase 4).
- [ ] **No `dangerouslySetInnerHTML`** unless sanitized — never render raw user HTML.
- [ ] **No hardcoded hex colors** (breaks theming + dark mode).
- [ ] Forms **never trust client input** — validation is UX; server (Phase 2) enforces truth.

---

## Phase 3 — Final Verification

- [ ] Theme system works in light + dark (Task 1).
- [ ] Full component library built, zero hex colors (Task 2).
- [ ] Role-aware shell + four dashboards render (Task 3).
- [ ] Status badges correct on every status (Task 4).
- [ ] `DocumentForm` renders any contract with validation + smart inputs (Task 5).
- [ ] Mock data layer complete, contract-shaped (Task 6).
- [ ] One end-to-end demo flow clicks through on mock data (Task 7).
- [ ] Security checklist green.

**The UI is real now.** Move to [phase-4.md](phase-4.md) — replace mock data with live Convex wiring.
