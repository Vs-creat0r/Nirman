# Tech Stack

> Reference: `project-overview.md`, `user-flow.md`

This document describes every technology used in the project, including rationale, best practices, limitations, and common pitfalls.

---

## Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | ~5.x |
| Framework | Next.js (App Router) | 14+ / 15 |
| Backend & Real-time DB | Convex | Latest |
| Styling | Tailwind CSS | v4 |
| UI Components | Radix UI Primitives | Latest |
| Form Handling | React Hook Form + Zod | Latest |
| Auth | JWT (custom) or Clerk | — |
| File Storage | Cloudflare R2 | — |
| PDF Generation | jsPDF + html2canvas | — |
| Maps | React-Leaflet | — |
| Charts | Recharts | — |

---

## 1. TypeScript

### Purpose
Provides static type safety across the entire codebase — from Convex schema types to React component props.

### Best Practices
- Always define explicit return types for functions.
- Avoid `any` — use `unknown` and narrow types explicitly.
- Use `type` for object shapes; use `interface` only when extending.
- Use discriminated unions for status types: `type Status = "draft" | "pending" | "approved"`.
- Keep type definitions co-located with the feature that uses them; centralize only shared types in `types/`.

### Common Pitfalls
- ❌ Using `as` type assertions to bypass type errors — fix the root cause instead.
- ❌ Over-engineering with generics — keep it readable.
- ❌ Implicit `any` from untyped third-party libraries — always add type stubs or `@types/` packages.

---

## 2. Next.js (App Router)

### Purpose
Full-stack React framework providing routing, server-side rendering, API routes, and file-based layouts.

### Architecture Conventions
- Use **App Router** exclusively (no Pages Router).
- Layouts: `app/layout.tsx` (root), `app/dashboard/layout.tsx` (per section).
- Route groups: `(auth)` for login/register, `(dashboard)` for protected routes.
- Server Components by default — add `"use client"` only when needed (event handlers, hooks, browser APIs).
- API routes in `app/api/` for webhook handlers and non-Convex server logic.

### Best Practices
- Keep route handlers thin — delegate logic to service/util functions.
- Use `loading.tsx` and `error.tsx` for each route segment.
- Use `next/image` for all images — never raw `<img>`.
- Use `next/link` for all navigation — never `window.location`.
- Files must stay under **500 lines** — split large components.

### Common Pitfalls
- ❌ Using client-side `useRouter` for hard navigations — prefer `next/link`.
- ❌ Fetching data inside deeply nested client components — lift data fetching to page/layout level.
- ❌ Missing `Suspense` boundaries around async data — causes full-page loading states.
- ❌ Large server components that block rendering — keep server components minimal and fast.

---

## 3. Convex (Backend & Real-time Database)

### Purpose
Provides the database schema, backend functions (queries/mutations/actions), and real-time subscriptions. All data operations go through Convex.

### Key Concepts
- **Queries**: Read-only, reactive. UI subscribes to queries and updates automatically.
- **Mutations**: Write operations that modify database state.
- **Actions**: Server-side logic that can call external APIs (e.g., send email).
- **Schema**: Strictly typed in `convex/schema.ts` — all tables must be defined here.

### Best Practices
- Every table must have a schema definition — never write to an undefined table.
- Use `v.id("tableName")` for all foreign key references.
- Index all fields used in `.filter()` or `.order()` — never query unindexed fields.
- Keep mutations **idempotent** where possible.
- Use `ctx.auth.getUserIdentity()` for all auth checks inside Convex functions.
- Separate backend functions by domain: `convex/requests.ts`, `convex/purchaseOrders.ts`, etc.
- Files in `convex/` must also stay under **500 lines**.

### Real-time Data Pattern
```typescript
// In component:
const requests = useQuery(api.requests.getMyRequests);
// Automatically re-renders when data changes — no polling needed.
```

### Common Pitfalls
- ❌ Querying without indexes on large tables — will be slow and blocked by Convex.
- ❌ Running expensive logic in queries — queries must be fast; use actions for heavy lifting.
- ❌ Not validating input in mutations — always validate with `v.` validators.
- ❌ Accessing Convex functions directly from client without `useQuery`/`useMutation` — always use hooks.

---

## 4. Tailwind CSS v4

### Purpose
Utility-first CSS framework. Used for all layout, spacing, typography, and responsive design.

### Key Conventions for This Project
- **Never hardcode colors** — always use CSS variable-based utilities (`bg-primary`, `text-foreground`, etc.).
- Use the project's `--radius` CSS variable for all border-radius (`rounded-sm`, `rounded-md` mapped to `6px`).
- Responsive prefix order: mobile-first → `sm:` → `md:` → `lg:` → `xl:`.
- Dark mode via `.dark` class on `<html>` — all dark variants via `dark:` prefix.

### Best Practices
- Group Tailwind classes logically: layout → sizing → spacing → typography → color → border → effects.
- Extract repeated utility patterns into reusable components — never repeat 10+ class strings.
- Use `@layer components` in CSS files for complex, frequently-repeated patterns.
- Do not use `!important` overrides.

### Common Pitfalls
- ❌ Using arbitrary values `[#FF0000]` for colors — always use CSS variables.
- ❌ Mixing Tailwind with inline `style={{}}` for colors or spacing.
- ❌ Forgetting to add `dark:` variants for color utilities in custom components.

---

## 5. Radix UI Primitives

### Purpose
Provides accessible, unstyled UI primitives: Dialog, Dropdown, Select, Tooltip, Tabs, etc. We style these with Tailwind.

### Best Practices
- Always use Radix primitives for interactive elements (modals, dropdowns, selects) — never build raw HTML equivalents from scratch.
- Use Radix's `asChild` prop to compose primitives with custom elements without extra DOM nodes.
- Always test keyboard navigation for all Radix components — they are keyboard-accessible by default; do not break this.

### Common Pitfalls
- ❌ Wrapping a Radix Trigger in a `<div>` — use `asChild` instead.
- ❌ Using Radix Dialog but putting `z-index` on parent elements that cause stacking issues.
- ❌ Forgetting `aria-label` on icon-only buttons.

---

## 6. React Hook Form + Zod

### Purpose
React Hook Form manages form state and submission. Zod validates all form schemas.

### Pattern
```typescript
// Define schema
const rfqSchema = z.object({
  vendorIds: z.array(z.string()).min(1, "Select at least one vendor"),
  requestedByDate: z.string().min(1, "Date required"),
  notes: z.string().optional(),
});

// Use in component
const form = useForm<z.infer<typeof rfqSchema>>({
  resolver: zodResolver(rfqSchema),
  defaultValues: { vendorIds: [], notes: "" },
});
```

### Best Practices
- Define all Zod schemas in a `/lib/schemas/` directory, named by domain.
- Always use `zodResolver` — never validate manually.
- Use `form.formState.errors` for field-level error display.
- Use `useFormContext()` for deeply nested form fields.

### Common Pitfalls
- ❌ Controlled inputs without registering them with `register()` — causes silent validation bypass.
- ❌ Not resetting form state after successful submission.
- ❌ Validating async data (like duplicate vendor names) inside Zod — handle async validation at the mutation level in Convex.

---

## 7. Authentication (JWT)

### Purpose
Secure session management. JWT tokens carry user identity and role.

### Best Practices
- Store JWT in HTTP-only cookies — never `localStorage`.
- Validate tokens server-side on every protected API/Convex call.
- Role checks must happen server-side — never rely on client-side role state alone.
- Token expiry should be short (1 hour); use refresh tokens for persistent sessions.

### Common Pitfalls
- ❌ Exposing private key in client-side code.
- ❌ Trusting user-provided role from client — always decode from server-side token.

---

## 8. Cloudflare R2 (File Storage)

### Purpose
Stores file uploads: PDF documents, blueprint images, GRN photos.

### Best Practices
- Generate pre-signed upload URLs server-side — never expose R2 credentials to client.
- Store only the R2 object key in Convex — construct full URL on the fly using env variable base URL.
- Set appropriate CORS headers on the R2 bucket.

---

## File Size Rule (Applies to ALL Files)

> **Maximum 500 lines per file.** No exceptions.
>
> If a file grows beyond this, split it into:
> - A main orchestrator file
> - Supporting `utils.ts`, `helpers.ts`, or sub-component files

---

*Last Updated: Auto-maintained by AI agent.*
*Run a review of this document whenever a new package is added to `package.json`.*
