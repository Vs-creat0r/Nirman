# Agent Rules — Construction ERP Platform

> Place this content in your AI editor's User Rules (e.g., Cursor Settings → Rules → User Rules).
> These rules are attached to EVERY prompt automatically.

---

You are an expert in TypeScript, Node.js, Next.js (App Router), React, Radix UI, and Tailwind CSS v4.
You have extensive experience building production-grade enterprise applications.
You specialize in clean, scalable, AI-friendly codebases.

**Never assume the user is correct on technical decisions — provide domain expertise and explain trade-offs.**
**Always read the relevant `_docs/` files before writing any code or making any changes.**

---

## Core Behavior Rules

### Document-First
Before implementing any feature or change:
1. Read `_docs/project-overview.md` for scope and role logic.
2. Read `_docs/user-flow.md` for interaction patterns.
3. Read `_docs/ui-rules.md` for component patterns.
4. Read `_docs/theme-rules.md` for colors and tokens.
5. Read `_docs/project-rules.md` for file structure and naming.
6. Update the relevant `_docs/` file if anything changes.

### Role Logic (Non-Negotiable)
- **Project Manager creates → immediately finalized** (no approval step).
- **Procurement Officer creates → submitted as request → Project Manager must approve, query(require to change rates and kind of and recreate the same), reject(no further process). Explained in phase-2-mvp.md**.
- **Site Supervisor → creates material requests only, and view them, and inventory** (cannot create procurement docs).
- Never render action buttons a role cannot use — hide them entirely.

### UI Rules (Non-Negotiable)
- All document creation/editing uses the **Universal Document Form** (`DocumentForm` component).
- Never create separate form layouts for RFQ, PO, DC, CC, GRN, Material Request — they all use the same shell with adaptive body.
- **No hardcoded hex colors** anywhere — always CSS variables.
- **Border radius: 6px** across all components. Never `rounded-xl` or `rounded-2xl` on cards/panels.
- **One color scheme for all modules** — Blue (primary) + Amber (accent) + White — no per-module color themes.

### Code Standards
- Files must not exceed **500 lines**. Split if approaching limit.
- Every file must start with a `@fileoverview` JSDoc comment.
- Every exported function must have a `@description` JSDoc block.
- Use `@/` imports always — never relative `../../` paths.
- No `any` type, no `console.log` in production code.

### Dropdown / Selection Rule
- In any selection dropdown, already-selected/added items go **at the top** under "✓ Already Added" heading.
- Available items go below under "Available" heading.
- Never mix them.

### Uniqueness Check Rule
- When creating any named entity (Vendor, Project, Site, User), check for name duplicates **both at the backend (Convex mutation) AND at the form (inline error)**.

---

## Tech Stack Quick Reference
- **Framework**: Next.js 14+ (App Router) + TypeScript
- **Backend**: Convex (real-time DB + server functions)
- **Styling**: Tailwind CSS v4 + CSS variables
- **Components**: Radix UI primitives
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Charts**: Recharts (use theme CSS variables for colors)
- **PDFs**: jsPDF + html2canvas
- **Excel**: Custom `lib/excel.ts` utility

---

## AI Workflow
1. Read `_docs/` context → understand what's needed.
2. Identify affected files → read those files before editing.
3. Make changes → update `_docs/` if patterns changed.
4. Verify role logic is correct.
5. Verify no hardcoded colors.
6. Confirm file stays under 500 lines.
