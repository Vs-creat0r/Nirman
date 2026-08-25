# Nirman — Repository Audit
### `github.com/Vs-creat0r/Nirman` @ `06af32a` · 25 Aug 2026

**Auditor:** Claude (Sprint Lead / Architect)
**Method:** full read of `convex/` (19 files), `app/` + `components/` (58 files, 11.8k lines), contracts, codegen, theme layer. Two independent deep-audit passes plus manual verification of every CRITICAL and HIGH finding.

---

## 0. Executive summary

**Where the sprint actually landed:** Days 1–3 shipped. Day 4 did not. The pipeline runs **Material Request → Approval → Cost Comparison → Purchase Order** and stops there. Delivery Challan and GRN have schema and nav links but no backend, no UI, and no route — the product has no terminus.

**What you built is more than the plan asked for.** Vendor dossiers with spend history, a five-stage pipeline stepper, T&C templates, company profile settings, document lineage bars, HSN/SAC codes. That's real work and the CC/PO surface is genuinely good.

**But it is not deployable to a real site.** There are four independent ways to take the system over completely, and the most severe is one line long. The plan's three architect decisions have each been reversed in practice — and the contract-first architecture, the one I called "the single highest-leverage decision in the sprint," is now **mechanically broken**: `node scripts/generate-from-contracts.mjs` exits with a validation error. You cannot regenerate the schema. The file that says `// GENERATED FILE — do not edit` has been edited.

**Verdict:** do not open this to real users. It is roughly 50 hours from production-ready, and Sprint 2 has to be a hardening-and-completion sprint, not a features sprint. RFQ and Path-1 routing move to Sprint 3.

| Sprint-1 "Definition of Done" | Status |
|---|---|
| Live production URL | ✅ |
| 4 roles land on role-correct dashboards | ✅ |
| MR travels the full pipeline to GRN | ❌ **stops at PO** |
| Every state change in the audit log | ⚠️ 1 silent transition; vendor + settings changes unlogged |
| Every mutation enforces role server-side | ⚠️ enforced, but the policy is **client-supplied** in one place |
| Light + dark correct on every screen | ❌ 250 hardcoded colors; 3 undefined theme tokens |
| No hardcoded colors in components | ❌ 250 across 25 files |
| No file over 500 lines | ❌ 6 files over; worst is 774 |
| `HANDOVER.md` written | ❌ |

---

## 1. CRITICAL — fix before anyone else logs in

### C1 · Client supplies its own authorization policy → total RBAC bypass
`convex/transition.ts:125-146`

`executeTransition` is a **public** mutation that takes `actorRole: v.array(v.string())` **from the client** and hands it straight to `requireRole(ctx, args.actorRole, args.token)`. The caller chooses the list it will be checked against.

```
executeTransition({
  table: "purchase_order", documentId: "<any id>",
  to: "approved_po",
  actorRole: ["site_supervisor"],   // ← attacker picks the allowlist
  token: "<own valid supervisor token>"
})
```
`requireRole` dutifully confirms the supervisor is a supervisor, and approves the purchase order. Every status on every document is reachable by every logged-in user. No UI calls this function — it is dead code that is nonetheless live and exploitable.

**Fix:** delete the public `executeTransition` export. Keep the internal `transition()` helper. Authorization lists are compile-time constants, never arguments.

### C2 · Passwords stored and compared in plaintext, with a magic-suffix fallback
`convex/auth.ts:26`, `convex/seed.ts:16-25`

```ts
if (user.passwordHash !== args.password && user.passwordHash !== `${args.password}123`)
```
The field is named `passwordHash`. It holds the password. The seed writes `admin` / `admin123`, `manager` / `manager123`. Anyone with database read access — and `users.list` grants exactly that to *any* logged-in user (C3) — has every credential in the system.

**Fix:** bcrypt/scrypt via a Convex action, or move to a managed provider. Re-seed and force a rotation; treat all existing credentials as compromised.

### C3 · Every user's password is served to the browser on every page load
`convex/users.ts:6-19`, `:30-38`

`getUserFromToken` returns the raw user document — `passwordHash` included. `getMyUser` exposes it publicly and the frontend calls it on **every page load** via `useRole()`. Separately, `users.list` has *no role check at all* (only "is there a session"), so a site supervisor can enumerate every account, role, phone, email and plaintext password in the org.

**Fix:** strip `passwordHash` in a serializer at the boundary. Gate `users.list` to admin.

### C4 · Session tokens are `Math.random()`
`convex/auth.ts:32`

```ts
const token = `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
```
`Math.random()` is not a CSPRNG; V8's xorshift128+ state is recoverable from a handful of outputs. `Date.now()` is public. Tokens live 30 days, never rotate, and are stored in `localStorage` (`components/providers/auth-provider.tsx:33`) — readable by any XSS, and sent as a **plain mutation argument**, so they land in every Convex WebSocket frame and error payload.

**Fix:** `crypto.getRandomValues` / `crypto.randomUUID`, httpOnly + SameSite cookie, rotate on login, and a real expiry sweep.

### C5 · `seedAll` is a public, unauthenticated mutation
`convex/seed.ts:10`

Anyone who knows the deployment URL can call it. It deletes users (`:36`), resets passwords (`:18-25`) and rewrites master data — **against production**.

**Fix:** `internalMutation`. Run from CLI only.

### C6 · Every input and every hand-rolled modal in the app is invisible
`app/globals.css:4-56`

The `@theme` block defines `--color-surface`, `--color-popover`, `--color-status-*`… but **not** `--color-card`, `--color-input`, or `--color-ring`. Tailwind v4 generates utilities only from `@theme` keys, so `bg-card`, `bg-input`, `border-input` and `ring-ring` — used **34 times** — emit *zero CSS*.

Consequence: the Generate PO, Edit PO, Vendor Form, Vendor Dossier and T&C modals render as transparent panels floating on a `bg-black/60` scrim. Every text field in the design system has no background. `focus-visible:ring-ring` sets no color, so an amber button gets an amber focus ring.

**This is three lines of CSS.** It is CRITICAL only because it sits on the primary procurement path.

---

## 2. HIGH — data integrity and business rules

### H1 · "Submit for Approval" saves a draft
`app/(dashboard)/dashboard/supervisor/material-requests/new/page.tsx:99, 112-129`

`onSubmit` is bound to `handleSave(data, false)`. The prominent "Submit for Approval" button reaches into the DOM, finds `button[type="submit"]`, and `.click()`s it — running that same `submitImmediately: false` path. The supervisor fills the form, clicks Submit, gets navigated to the detail page, and the request is in **draft**. It never reaches the Project Manager. The DOM-click also defeats the `disabled={isSubmitting}` double-submit guard.

*The entry point of the entire pipeline is broken.*

### H2 · Cost Comparison can be raised against a rejected or draft Material Request
`convex/cost_comparisons.ts:152-156, 192`

`createCC` fetches the MR and checks only `if (!mr)`. **No status guard.** Line 192 then advances the MR to `review_cc` from `ready_for_cc` **or `draft`**. A CC can be built on a request the PM rejected, approved, and turned into a binding PO. The "PM approves first" gate is optional. (`createPOFromCC` at `:65` guards correctly — the CC path just forgot.)

### H3 · Quantities on a Cost Comparison are never checked against the approved request
`convex/cost_comparisons.ts:41-115`

`processVendorQuotes` validates ≥2 quotes, distinct vendors, non-empty items — and never compares against `mr.items`. Supervisor requests 10 bags of cement; PM approves 10; officer enters quotes for 10,000; the comparison view shows only quotes, so the PM approves; `createPOFromCC:94-106` snapshots it verbatim. **A PO for 1000× the approved quantity.**

### H4 · Unlimited duplicate POs from one Cost Comparison
`convex/purchase_orders.ts:43-216`

No check that a PO already exists for `costComparisonId`. Deduplication lives only in the *read* query `listApprovedCCsForPO:569` — cosmetic UI filtering. A double-click, or a replayed mutation, issues N distinct approved POs for the same materials. The vendor ships and invoices N times. Nothing downstream reconciles it.

### H5 · A 0% tax quote becomes an 18% purchase order
`convex/purchase_orders.ts:111`, `:452`

```ts
const taxRate = Number(winningQuote.taxRate) || 18;   // 0 || 18 === 18
```
`processVendorQuotes:96` explicitly permits `taxRate: 0`. A GST-exempt vendor quotes ₹100,000; the CC shows ₹100,000; the PO sent to the vendor says ₹118,000. Use `?? 18`.

### H6 · Negative quantities rig the lowest-quote check
`convex/cost_comparisons.ts:81-84`

`rate` is clamped with `Math.max(0, …)`. `quantity` is not. A line at `quantity: -500` drags a favoured vendor's total below the genuine lowest bid, so the "not lowest → justification required" gate at `:306-311` never fires. The PM approves a rigged comparison believing it was competitive.

### H7 · No row-level scoping exists anywhere
`convex/schema.ts:343-344`

`assignedProjectIds` and `assignedSiteIds` are declared and **never read** outside the schema. Every query authorizes by role alone. `getMR`, `getCC`, `getPO` and `getDocumentLogs` accept any document ID and return it. Textbook IDOR — and `listCCs` / `listPOs` hand out the IDs.

Worse: `site_supervisor` is in the allowed-roles list for `listCCs`, `getCC`, `listPOs`, `getPO`, `listVendors`, `listVendorsWithStats`, `getVendorDetails`, `getVendor`. **The lowest-privilege role can dump every vendor quote, negotiated rate, per-vendor total spend and every PO total across every project** — directly contradicting "Site Supervisor → material requests and inventory only."

### H8 · Role gating exists only in the UI, and not much of it
`middleware.ts:4-6` is a no-op. `app/(dashboard)/layout.tsx` has no auth check. `useRole()` is called in 6 files and **never once to hide an action**. Manager action buttons gate on document *status*, not viewer role:

```tsx
{isSubmitted && (<Query/><Reject/><Approve & Select Vendor/>)}
```
A supervisor who types `/dashboard/manager/cost-comparisons/<id>` sees the full vendor price comparison and live Approve/Reject buttons. Clicking one surfaces the raw server string — leaking internal role identifiers. The documented rule is *hide it entirely*.

### H9 · Contract-first architecture is mechanically broken
```
$ node scripts/generate-from-contracts.mjs
✖ Contract validation failed:
  - purchase_order.tcTemplateId: relation.table "tc_templates" is not a contract
```
`convex/schema.ts` carries `// GENERATED FILE — do not edit` and has been edited: a `tc_templates` table (`:308`) and a `tcTemplateId` field were added by hand. There is no `contracts/tc_templates.json`, **no `gen` script in `package.json`**, and no CI check. The generator cannot run, so the contracts are now decorative and the schema is hand-maintained. This is the architecture decision the whole build was organised around, and it has silently lapsed.

### H10 · Audit log will eventually break every detail page
`convex/material_requests.ts:360`, `cost_comparisons.ts:652`, `purchase_orders.ts:644`, `logs.ts:33`

All four do `ctx.db.query("logs").filter(...).collect()` — a **full table scan**. The `by_documentType_documentId` index exists but is unusable from these call sites (they never pass `documentType`), and there is no single-field `by_documentId` index. `logs` is append-only and grows on every transition of every document. Once it passes Convex's per-query read limit, opening *any* MR, CC or PO detail page throws — **permanently, and un-rollback-able, because you cannot delete audit rows.**

`dashboard.ts:112` collects the entire `logs` table to slice the newest 6, on the highest-traffic screen in the app, re-run reactively on every write.

### H11 · Site Supervisor's primary input is unusable on a phone
`components/document/inputs/item-list-input.tsx:83-95`

The item-list table has a ~546px minimum width inside `overflow-x-auto`. Controls are `h-8` (32px); the delete button is ~26px. On a 375px phone — the stated device — adding a line item means horizontal scrolling to reach quantity and unit. All inputs are `text-xs` (12px), which triggers iOS Safari auto-zoom-on-focus, so every tap re-zooms and re-scrolls. WCAG 2.5.8 minimum is 24px; a gloved thumb needs ~44px.

The comment at `:72` says "Responsive Table / Card List." Only the table was built.

### H12 · Five of seventeen nav destinations are 404s
`lib/nav-config.ts` links `/dashboard/deliveries`, `/dashboard/inventory`, `/dashboard/grn`, `/dashboard/logs`, `/dashboard/users`. None exist. For `site_supervisor` that is **4 of 6 nav items**. There is no `not-found.tsx` anywhere, so each lands on Next's bare default 404 *outside the dashboard shell*, with no way back but the browser button.

### H13 · Universal Document Form has collapsed to one document type
`components/document/document-form.tsx` (228 lines) has exactly two consumers, both Material Request. `contracts/cost_comparison.json` and `contracts/purchase_order.json` are **never imported by any UI file**.

Bespoke CC + PO UI: **4,579 lines — 39% of the entire frontend.** The two PO detail pages are ~68% identical; the audit-log timeline block is duplicated verbatim in **six** files. Four list pages hand-roll their own `<table>` instead of using `DocumentTable`.

The abstraction is not earning its keep as built. Either wire the existing contracts through it, or drop the claim from the docs — but do not add a seventh bespoke page while the rules say all six render through one shell.

---

## 3. MEDIUM — accumulate into real cost

| # | Finding | Location |
|---|---|---|
| M1 | `submitPO` patches the MR status with **no audit log at all** — a genuine gap in the trail | `purchase_orders.ts:250-255` |
| M2 | 6 status changes bypass `transition()`, so they carry no `from`-guard. Two accept *any* current status — a stale second CC can drag a **delivered** MR back to `ready_for_po` | `cost_comparisons.ts:193,252,338`; `purchase_orders.ts:189,250,302` |
| M3 | `resubmitPO` accepts arbitrary line items, rates, tax and terms with no re-validation against the approved CC. PM queries a PO; officer resubmits at a higher rate; the diff is invisible | `purchase_orders.ts:408-479` |
| M4 | Negotiated payment terms silently discarded — free-text `"50% advance"` misses the map and becomes `30_days` on the document sent to the vendor | `purchase_orders.ts:124` |
| M5 | `createCC` inserts `"" as any` for a required `v.id("sites")` when the MR has no site — throws at insert, dead-ends that MR | `cost_comparisons.ts:169` |
| M6 | `requireManagerApprovalForRequests` is written, read back, seeded — and enforced **nowhere**. An admin toggles it, sees it persist, and believes a control exists that does not | `company_settings.ts:69` |
| M7 | `updateVendor`, `deactivateVendor`, `updateCompanyProfile` write no audit rows. A vendor deactivated mid-tender leaves no trace | `vendors.ts:281,307`; `company_settings.ts:62` |
| M8 | Quotes accepted from non-existent or deactivated vendors — `vendorId` is never resolved | `cost_comparisons.ts:41-115` |
| M9 | `refNo` generation full-scans the table; `by_refNo` indexes are non-unique with no collision re-check | `material_requests.ts:21`; `cost_comparisons.ts:22`; `purchase_orders.ts:23` |
| M10 | N+1 `db.get` inside `Promise.all` over unbounded `collect()` — `listPOs` on 500 POs is ~3,000 reads per call, re-run on every write | `purchase_orders.ts:516`; `cost_comparisons.ts:520`; `vendors.ts:75` |
| M11 | `filter()` where an index exists. `listProjectItems` scans every BOQ line of every project on every autocomplete keystroke | `project_items.ts:27`; `projects.ts:25`; `sites.ts:33` |
| M12 | Procurement dashboard shows **"All site requests are processed"** with ₹0 KPIs while still loading — loading is indistinguishable from empty | `procurement/page.tsx:34-37, 400, 453` |
| M13 | Logged-out or still-loading users are shown the **Site Supervisor** nav: `const activeRole = role \|\| "site_supervisor"` | `sidebar.tsx:27` |
| M14 | Any deep link hit while logged out spins forever — `useQuery` is skipped, stays `undefined`, no redirect | every `[id]` page |
| M15 | 250 hardcoded Tailwind colors in 25 files; only 37 have a `dark:` companion. `themes.css`'s entire `--status-*` palette is **dead code** — `status-badge.tsx` reimplements all 33 colors by hand | `procurement/page.tsx` (63), `status-badge.tsx` (33) |
| M16 | Contrast failures on the highest-consequence controls: Approve / Authorize / Generate PO are `bg-emerald-600 text-white` = **3.77:1**; "Edit & Resubmit" is `bg-amber-500 text-white` = **2.15:1**; every "Pending Review" badge is `text-amber-500` on white = **2.15:1**. AA needs 4.5:1 | 8 CTAs, 5 buttons, all badges |
| M17 | Five modals bypass Radix Dialog — no focus trap, no ESC, no `role="dialog"`, no scroll lock | `edit-po-modal.tsx:139`; `generate-po-modal.tsx:118`; `vendors/page.tsx:485,623`; `settings/page.tsx:503` |
| M18 | `key={idx}` on a spliceable list of controlled inputs — removing quote #2 of four attaches in-flight values to the wrong vendor | `cost-comparisons/new/page.tsx:314` |
| M19 | Settings form wipes unsaved edits whenever the live Convex query updates | `settings/page.tsx:49-63` |
| M20 | 6 files over the 500-line cap: 774 / 634 / 590 / 515 / 496 / 463 | see §5 |
| M21 | 78 `any`, 27 relative imports, `alert()` and `confirm()` for error and destructive-action UX, 1 `console.warn` | 19 files |
| M22 | Selected dropdown items are interleaved-and-disabled, not grouped above. No `<optgroup>` anywhere in the codebase | `cc-vendor-quote-panel.tsx:152` |
| M23 | **Zero tests. Zero CI.** No `.github/`, no test runner, no `gen:check` | repo root |
| M24 | `@clerk/nextjs` and `@convex-dev/auth` are both installed and **neither is used** — dead weight in every bundle | `package.json` |
| M25 | `nirman-setup/` is a complete second copy of contracts + codegen + schema committed alongside the live one | `nirman-setup/` |
| M26 | No `error.tsx`, `loading.tsx`, `not-found.tsx` or `global-error.tsx` at any level. 25 of 27 files in `app/` are `"use client"`, including the dashboard layout | `app/` |

---

## 4. What's good — and worth protecting

Stated plainly, because the list above is long:

- **`convex/rbac.ts` is clean.** It fails closed on a missing token, checks `isActive`, and is consistently applied. The C1 bypass is a call-site defect, not a design flaw.
- **`transition()` is a genuinely good abstraction** — RBAC, `from`-guard, patch and audit row in one place. The problem is that six call sites route around it, not that it's wrong.
- **`themes.css` is well designed**, with complete dark overrides for every token. It is being ignored, not out-grown. Nearly all of §M15–M16 is fixable by *using what already exists*.
- **`DocumentTable` handles loading, empty and no-results correctly** — the right pattern already lives in the repo; four list pages just don't use it.
- **Double-submit guards are present on essentially every form.**
- **`components/ui/*` and `components/document/inputs/*` follow the rules.** The violations are concentrated in page-level code written on top of them — which means the fix is mostly consolidation, not rewriting.
- **The CC/PO domain modelling is ahead of the plan** — vendor dossiers with spend history, T&C templates, HSN/SAC, lineage bars. That is Sprint-2 and Sprint-3 work already banked.

---

## 5. Files over the 500-line cap

| File | Lines | Extract |
|---|---|---|
| `procurement/vendors/page.tsx` | **774** | Two inline modals → `vendor-dossier-modal` + `vendor-form-modal`; 9-col table → `VendorTable`; KPI cards → shared `MetricCard`. Target ~180 |
| `procurement/page.tsx` | **634** | Stepper → `procurement-pipeline-stepper`; 4 queue tabs → `queue-*.tsx`; KPI row → `MetricCard`. Target ~150 |
| `admin/settings/page.tsx` | **590** | Three tab bodies + template modal → 4 components. Target ~120 |
| `procurement/purchase-orders/[id]/page.tsx` | **515** | `po-summary-card`, `po-line-items-table`, `audit-log-timeline` (duplicated verbatim in **6** files) |
| `manager/purchase-orders/[id]/page.tsx` | **496** | Same extractions — then ~120 lines of manager-specific wiring remain |
| `components/shared/document-table.tsx` | **463** | Under cap but at risk: 5 copy-paste `<th>` → `SortableHeader`; toolbar → `document-table-toolbar` |

The highest-leverage single extraction in the codebase: **a read-only universal document detail shell.** Six near-identical detail pages, ~2,400 lines, share the same skeleton — lineage bar → summary card → metadata grid → line-item table → audit log.

---

## 6. The three architect decisions, revisited

| Decision | Called for | What shipped | Call |
|---|---|---|---|
| **D1 — Convex Auth (Password), fall back to Clerk at the 45-min mark** | Managed provider | Hand-rolled sessions: plaintext passwords, `Math.random()` tokens, `localStorage`, token-as-argument. Both `@convex-dev/auth` **and** `@clerk/nextjs` are installed and unused | ❌ **Reversed.** This is exactly the trap the time-box existed to prevent, and it produced 4 of the 6 CRITICALs |
| **D2 — Convex file storage, not R2** | Convex storage | `v.id("_storage")` declared in the schema. **No upload implemented anywhere** — no `generateUploadUrl` call in the repo | ⏸ Untested — GRN photos were Day 4 |
| **D3 — Schema generated from contracts, never hand-written** | Codegen is the only writer | Schema hand-edited; generator now **fails validation**; no `gen` script; no CI check | ❌ **Reversed.** Silently, which is the dangerous way |
| **D4 — One transition helper owns every status change** | Single writer | Helper is good; 6 call sites bypass it; 1 writes no log at all | ⚠️ **Eroding** — the pattern held for MR and broke as CC and PO were added under time pressure |

**The lesson worth carrying into Sprint 2:** three of four deviations happened during Day 3, the fastest and most productive day. Speed did not cost you features — it cost you the invariants. Sprint 2 has to make the invariants machine-checked, not documented, or the same thing happens again.

---

## 7. Recommended posture

1. **Do not onboard real users or real vendor data.** C1–C5 are individually sufficient for full compromise.
2. **Treat every seeded credential as public.** Rotate after the auth rebuild.
3. **Freeze feature work.** RFQ, Path-1 routing and partial delivery move to **Sprint 3**. Adding surface area to a codebase with a client-supplied authorization policy makes the re-audit larger every day.
4. **Close the pipeline before polishing it.** DC → GRN is what makes this a product rather than a demo.
5. **Make the invariants executable.** `gen:check`, a role-matrix test, and a contrast lint in CI would have caught H9, C1 and M16 the day they were introduced.

Full remediation plan: `claude/sprint-2-plan.md`.
