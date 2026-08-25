---
trigger: always_on
description: Non-negotiable architecture, security and UI rules for the Nirman ERP. Read before writing any code.
---

# Nirman — Invariants

Hard rules. They override your training defaults and any pattern you find in this repo — parts of this codebase already violate them and are being fixed. If a rule blocks you, stop and ask. Do not work around it.

Detail lives in `_docs/`. This file wins on conflict.

---

## 1. Architecture

**Contract-first. `contracts/*.json` is the only source of truth.**

- `convex/schema.ts`, `lib/schemas/*.ts` and `lib/contract-types.ts` are **generated**. Never edit them by hand — they carry a `// GENERATED FILE — do not edit` header.
- To change a field or add a table: edit the contract, then run `npm run gen`.
- A new table needs a contract. A relation pointing at a table with no contract **breaks the generator**.
- Before committing schema work, `npm run gen:check` must exit 0.

> This has already failed once: `tc_templates` was hand-added to `schema.ts`, and the generator now refuses to run. Do not repeat it.

**One writer per concern:**

| Concern | The only writer |
|---|---|
| Status changes + audit log | `transition()` in `convex/transition.ts` |
| Role checks | `requireRole()` / `permissions.ts` in `convex/` |
| Colors | CSS variables in `styles/themes.css` |
| Schema + Zod | `scripts/generate-from-contracts.mjs` |

---

## 2. Security — the rules that produced real bugs

**Authorization lists are compile-time constants. Never arguments.**

```ts
// FORBIDDEN — the caller chooses its own allowlist
args: { actorRole: v.array(v.string()) }
await requireRole(ctx, args.actorRole, args.token);

// CORRECT
await requireRole(ctx, ["project_manager", "admin"], args.token);
```

If a role list can reach a guard from outside the file, the guard does nothing.

**Every mutation and every query is guarded server-side.** No exceptions. A query that returns money, rates, vendor pricing or PO totals is as sensitive as a mutation.

**Never return a user document raw.** Strip `passwordHash` at the boundary. No secret ever reaches the client.

**Seed, migration and admin-only functions are `internalMutation`.** A public `mutation` is callable by anyone who knows the deployment URL.

**Scope by assignment, not just by role.** A user reaches only documents in their `assignedProjectIds` / `assignedSiteIds`. Role alone is not access control — `getX(id)` handlers that skip this are an IDOR.

**Client-side checks are cosmetic.** Hiding a button is UX. The server check is the security. Always write both.

---

## 3. Business rules

**Roles**

| Role | Can do |
|---|---|
| `site_supervisor` | Material requests + inventory **only**. Never procurement documents. Never vendor pricing, quotes, or PO totals |
| `procurement_officer` | Creates → submitted as a request → PM approves / queries / rejects |
| `project_manager` | Creates → immediately finalized, no approval step. Approves others' documents |
| `admin` | Everything |

**Pipeline**

`Material Request → PM Approval → Cost Comparison → Purchase Order → Delivery Challan → GRN`

- A child document may only be created from an **approved** parent. Check the parent's status — never just that the parent exists.
- Child data is **snapshotted** at creation. Never live-join to the parent; approved quantities and rates must not change retroactively.
- A child's quantities are **validated against the approved parent**. A CC cannot quote more than the MR approved.
- **One child per parent.** One CC per MR, one PO per CC. Check before insert — filtering it out of a list query is not a lock.
- Cost Comparison requires **≥ 2 quotes from distinct, existing, active vendors**, enforced server-side.
- CC approval requires **selecting a winning vendor**. Not the lowest quote → written justification required.
- PO auto-fills from the approved CC. **Zero manual re-entry.** On resubmit, re-validate against the CC — do not accept arbitrary rates.
- **GRN is never a form.** It is generated inside the DC's "Delivered" transition, with a photo upload as a precondition. No photo → no transition → no GRN.

**Money**

- `?? ` not `|| ` for numeric defaults. `0 || 18` is `18` — that turns a tax-exempt quote into an 18% invoice.
- Clamp quantities and rates to `>= 0`. A negative line item rigs the lowest-quote comparison.
- Never discard a negotiated value (payment terms, tax rate) by mapping it to a default.

**Audit**

Every state change writes a `logs` row with actor, role, timestamp, reference ID, from-status and to-status — via `transition()`, never a hand-written `ctx.db.patch({ status })` plus a manual insert. Master-data changes (vendor edit, deactivate, settings) are logged too.

---

## 4. UI

**Colors: CSS variables only.**

- Never `bg-emerald-600`, `text-amber-500`, `#0F172A`. Use `bg-success`, `text-warning`, `bg-primary`.
- Status badges use the `--status-*` tokens. They exist, with full dark-mode overrides, in `styles/themes.css`.
- Every token must be declared in the `@theme` block in `app/globals.css`. Tailwind v4 emits **no CSS** for an undeclared key — `bg-card` silently renders nothing.
- One color scheme across all six document types. Never a different palette per type.
- Every interactive control ≥ 4.5:1 contrast, both themes.

**Layout**

- Border radius 6px on cards, inputs, buttons. Never `rounded-xl` / `rounded-2xl` on panels.
- Use `components/ui/dialog.tsx` for modals. Never hand-roll `fixed inset-0` — you lose the focus trap, ESC, and scroll lock.
- Use `components/shared/document-table.tsx` for lists. Never a hand-rolled `<table>`.
- Already-selected dropdown items are grouped **above** available ones. Never interleaved-and-disabled.

**Mobile** — Site Supervisor screens are used on phones on site. Tap targets ≥ 44px. Inputs ≥ 16px font, or iOS auto-zooms on focus. Tables become cards below `sm`.

**States** — `useQuery` returning `undefined` means **loading**, not empty. Render a skeleton. Never show "All caught up" while data is still arriving.

**Never render an action a role cannot perform.** Hide it. Gate on the viewer's role, not just the document's status.

---

## 5. Code

- Files ≤ 500 lines. Split before the limit, not after.
- `@/` imports only. Never `../../`.
- No `any`. No `as any` on a Convex `Id<>` — that defeats the generated types.
- No `console.log`. No empty `catch`.
- No `alert()` / `confirm()`. Use themed dialogs.
- Duplicate-name checks (vendor, project, site, user) at **both** the mutation and the form.
- Index, don't scan. `withIndex()` over `filter()`. Never `.collect()` an unbounded table — `logs` grows forever and will eventually break every page that scans it.
- A fix for a CRITICAL or HIGH bug ships with a test that fails without it.

---

## 6. Working method

1. **Read before writing.** Check `_docs/` and the current sprint day file for what is in scope and what is explicitly cut.
2. **No silent scope creep.** If asked for something on the CUT list, say so and confirm first.
3. **Docs and code stay in sync.** A behavior change without a doc update is an incomplete change.
4. **Verify, don't assert.** Run the day's "Done when" checks before claiming completion.
5. **Ugly and shipped beats elegant and absent** — *except* in security and money code. There, stop and ask.
6. **When genuinely unsure** about a permission, a status transition, or a pattern not covered here — ask. Do not improvise.
