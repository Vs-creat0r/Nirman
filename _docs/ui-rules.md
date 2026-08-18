# UI Rules

> Reference: `project-overview.md`, `user-flow.md`, `tech-stack.md`, `theme-rules.md`
>
> This document defines visual and interaction guidelines for building all UI components.
> **Every developer must read this before writing any component code.**

---

## 1. Design Principles

### 1.1 Corporate, Not Decorative
- This is an internal enterprise tool used in procurement and site operations.
- Design must prioritize **clarity and efficiency** over decoration.
- No gradients for backgrounds. No glowing effects. No heavy shadows.
- Use whitespace intentionally to reduce cognitive load.

### 1.2 Role-Contextual Rendering
- The **same component renders differently** based on the logged-in user's role.
- Always check role before rendering action buttons, edit controls, or sensitive data.
- Never show a button that the current role cannot use — hide it entirely.

### 1.3 Status-First Design
- Every list item and document must show its **status badge prominently**.
- Status badges are the primary visual communication tool in this app.
- Do not use color alone to communicate status — always pair with text label.

### 1.4 Zero Hardcoded Colors
- All colors must use CSS variables from the theme system.
- See `theme-rules.md` for the complete color token reference.
- Violation of this rule will break dark mode and light mode switching.

---

## 2. Layout & Spacing

### 2.1 Page Layout Structure
```
┌──────────────────────────────────────────────────────┐
│                    Header (64px)                     │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │         Main Content Area               │
│  (240px)   │         (fills remaining width)         │
│            │                                         │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

- Sidebar is **collapsible** on `md` screens and hidden on mobile.
- Header height: **64px** — fixed, never changes.
- Sidebar width: **240px** expanded, **64px** collapsed (icon-only).
- Content area: full remaining width with `px-6 py-6` padding.
- **Project Selector**: A persistent toggle button at the top of the sidebar (collapses to an icon). Clicking it displays:
  - A project switching list.
  - A secondary panel option to view **Project Insights** (covering progress tracking, resource allocations, inventory items, billings & spending, and credits vs. debits).

### 2.2 Spacing Scale
Use Tailwind spacing consistently:

| Use Case | Tailwind Class | Value |
|---|---|---|
| Section gap | `gap-6` | 24px |
| Card padding | `p-5` | 20px |
| Form field gap | `gap-4` | 16px |
| Inline element gap | `gap-2` | 8px |
| Button padding | `px-4 py-2` | 16px / 8px |
| Small badge padding | `px-2 py-0.5` | 8px / 2px |

### 2.3 Grid System
- Use CSS Grid or Flexbox — not tables for layout.
- Dashboard summary cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Always define `gap` explicitly — never rely on margins between grid items.

---

## 3. Typography

### 3.1 Font Stack (iOS Native System)
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```
- Use native iOS SF Pro system typography as the primary typeface to achieve a native-app, high-trust visual quality.
- Fallback to Segoe UI on Windows and Roboto on Android.

### 3.2 Monospace & Numeric Font Stack
```css
font-family: "SF Mono", SFMono-Regular, ui-monospace, "SF Pro Mono", Consolas, monospace;
font-variant-numeric: tabular-nums;
```
- Use Apple SF Mono stack for all document IDs (e.g., `PO-029`), currency/monetary values, quantities, weights, and dates.
- This ensures clean alignment and readability of metrics in grids and tables.

### 3.2 Type Scale

| Element | Class | Size |
|---|---|---|
| Page title (h1) | `text-2xl font-semibold` | 24px |
| Section heading (h2) | `text-lg font-semibold` | 18px |
| Subsection (h3) | `text-base font-medium` | 16px |
| Body text | `text-sm` | 14px |
| Label | `text-xs font-medium` | 12px |
| Caption / hint | `text-xs text-muted-foreground` | 12px |

### 3.3 Rules
- **One `<h1>` per page** — always the page title.
- Use semantic HTML headings (`h1` → `h2` → `h3`) — do not skip levels.
- Long text in tables: truncate with `truncate` class and show full text in tooltip.

---

## 4. Border Radius

### 4.1 Global Standard: 6px
```css
--radius: 6px; /* Set in theme CSS variables */
```

| Element | Radius | Tailwind |
|---|---|---|
| Input fields | 6px | `rounded` → maps to `--radius` |
| Buttons | 6px | `rounded` |
| Cards / Panels | 6px | `rounded` |
| Modals / Dialogs | 8px | `rounded-md` |
| Badges / Tags | 4px | `rounded-sm` |
| Avatars | 50% | `rounded-full` |
| Tooltips | 4px | `rounded-sm` |

> ⚠️ Do **NOT** use `rounded-xl`, `rounded-2xl`, or `rounded-full` on cards or panels.
> This was a pain point in the previous system — it made the UI feel toy-like.

---

## 5. Component Standards

### 5.1 Universal Document Form (Core Pattern)
This is the **most important component** in the application. All document types (Material Request, RFQ, CC, PO, DC, GRN) render through this single component shell.

#### Structure
```
DocumentForm
├── DocumentHeader
│   ├── Back button
│   ├── Document title + type badge
│   └── Action buttons (role-gated)
├── DocumentMeta
│   ├── Status badge
│   ├── Created by
│   ├── Created at / Updated at
│   └── Document number/ID
├── DocumentBody   ← ADAPTS PER DOCUMENT TYPE
│   ├── [Material Request] → Item list + quantities + site/project
│   ├── [RFQ]             → Vendor selection + item list
│   ├── [Cost Comparison] → Multi-vendor quote table
│   ├── [Purchase Order]  → Vendor + line items + payment terms
│   ├── [Delivery Challan]→ Vehicle + dispatch items + arrival
│   └── [GRN]             → Received qty + condition + photos
├── DocumentNotes
│   └── Comments/Notes textarea (always visible)
└── DocumentFooter
    ├── [Cancel] button (left)
    └── [Save Draft] / [Submit] buttons (right)
```

#### Props Interface (TypeScript)
```typescript
type DocumentType = "MATERIAL_REQUEST" | "RFQ" | "COST_COMPARISON" | "PURCHASE_ORDER" | "DELIVERY_CHALLAN" | "GRN";

interface DocumentFormProps {
  type: DocumentType;
  mode: "create" | "edit" | "view";
  data?: Partial<DocumentData>; // Pre-filled data for edit/view
  onSubmit?: (data: DocumentData) => void;
  onCancel?: () => void;
}
```

### 5.2 Buttons

| Variant | Use Case | Style |
|---|---|---|
| `primary` | Main submit/approve action | `bg-primary text-primary-foreground` |
| `secondary` | Secondary actions | `bg-secondary text-secondary-foreground` |
| `outline` | Cancel, back, neutral actions | `border border-border bg-transparent` |
| `destructive` | Reject, delete | `bg-destructive text-destructive-foreground` |
| `ghost` | Icon-only, table row actions | `bg-transparent hover:bg-muted` |

**Rules:**
- Primary button is always on the right in any footer/action row.
- Cancel is always on the left.
- Icon-only buttons **must** have `aria-label`.
- Disabled state: `opacity-50 cursor-not-allowed` — still must look like a button.

### 5.3 Status Badges
```typescript
type Status = 
  | "draft" | "pending" | "queried" 
  | "ready_for_cc" | "cc_pending" | "ready_for_po" 
  | "pending_po" | "ready_for_delivery" | "delivery_processing" 
  | "delivered" | "rejected" | "cc_rejected";
```

**Badge Design Rules:**
- **No Background or Borders**: Status badges are rendered without a surrounding pill container, background tint, or borders. This maintains a highly modern, minimal layout.
- **Circular Status Dot**: Every badge must render a small circular status dot (`width: 6px`, `height: 6px`, `border-radius: 50%`) directly in front of the label.
- **Matching Text Color**: The text label of the status matches the color of the status dot (using CSS variables) with a medium weight (`font-medium`).
- All badge colors come from CSS variables (not hardcoded hex).
- Text is always legible — minimum 4.5:1 contrast ratio.
- Badges never have more than 2 words of text.
- Status badges on list rows: inline, right-aligned, compact (`text-xs`).
- Status on detail pages: larger `text-sm` with the circular dot.

### 5.4 Data Tables
- Use a consistent table component for all list views.
- Columns: always define `minWidth` to prevent overflow wrapping.
- Empty state: always show an empty state illustration/message — never blank whitespace.
- Loading state: show skeleton rows — not a spinner.
- Every table must support: search, sort (at least by date), pagination or virtual scroll.
- **No hardcoded row heights** — allow natural content flow.

### 5.5 Modals / Dialogs
- Use Radix `Dialog` primitive.
- Max width: `max-w-lg` for simple confirmation dialogs, `max-w-2xl` for forms.
- Always include a visible close button (X) in the top-right corner.
- Modals must trap focus and be closable with `Escape` key.
- Confirmation modals (delete, reject) must state the consequence clearly.

### 5.6 Forms
- Every input field must have a visible `<label>`.
- Error messages appear **below** the input in `text-destructive text-xs`.
- Required fields are marked with `*` in the label.
- Use `placeholder` only as a hint — not as a substitute for a label.
- Disable submit button while form is submitting (show spinner inside button).

### 5.7 Sidebar Navigation
- Active route: highlighted with `bg-primary/10 text-primary font-medium`.
- Inactive routes: `text-foreground/70 hover:bg-muted`.
- Icons required for every sidebar item — use Lucide React icons.
- Group related items under collapsible section headers.

---

## 6. Interaction States

All interactive elements must have **all 4 states styled**:

| State | Visual |
|---|---|
| Default | Normal appearance |
| Hover | `hover:` — subtle background or brightness change |
| Focus | `focus-visible:ring-2 ring-ring` — visible focus ring |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` |

---

## 7. Responsive Design

- **Mobile-first** approach — start with small screen layout, enhance for larger.
- Sidebar: hidden on mobile (hamburger menu opens drawer), collapsed at `md`, full at `lg`.
- Tables: on mobile, show only 2-3 key columns; hide secondary columns.
- Document Form: full-width on all breakpoints, single column on mobile.
- Dashboard cards: stack on mobile, 2-col on `sm`, 4-col on `lg`.

---

## 8. Accessibility

- **WCAG 2.1 AA** compliance is required.
- All images must have descriptive `alt` text.
- All form controls must have associated `<label>` elements.
- All icon-only buttons must have `aria-label`.
- Color must never be the **only** way to convey information — always pair with text.
- Test with keyboard navigation: `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`.

---

## 9. Prohibited Patterns

> These were pain points in the previous system. Do **NOT** repeat them.

- ❌ Different color per document type (green for PO, pink for DC, etc.) — use one theme color.
- ❌ Excessive border radius (`rounded-xl`, `rounded-2xl`) on cards/forms.
- ❌ Per-module color themes — all modules use the same brand color.
- ❌ Hardcoded hex colors anywhere in component files.
- ❌ Different layout patterns for different document forms — use the Universal Document Form.
- ❌ Heavy drop shadows (`shadow-xl`, `shadow-2xl`) on cards.
- ❌ Animated entrance/exit for every element — animations only on modals and toasts.

---

*Last Updated: Auto-maintained by AI agent.*
*Update this document whenever a new component type is introduced or a UI pattern decision is made.*
