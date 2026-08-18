# Nirman — 4-Day Build Sprint Plan
### Construction Site ERP · Procurement Flow · 40 hours solo

**Sprint Lead / Architect:** Claude
**Builder:** you (solo)
**Window:** 4 days × 10 h = 40 h
**Target:** production-deployed, database-backed procurement application on Vercel + Convex

---

## 0. The one thing that decides this sprint

You have 40 hours and a spec sized for roughly 120. **The sprint is won or lost on scope discipline, not on typing speed.** Everything below is organised around one idea: build the *spine* of the procurement flow end-to-end and deliberately leave the branches unbuilt.

A half-finished pipeline with six polished screens is a failed sprint. A complete pipeline with six plain screens is a shippable product.

---

## 1. Scope decision (Sprint Lead's call)

You asked me to make the cut. Here it is, and it is not negotiable mid-sprint.

### ✅ SHIP — in the 40 hours

| # | Capability | Why it's in |
|---|---|---|
| 1 | Auth + 4 roles (Site Supervisor, Project Manager, Procurement Officer, Admin) | Nothing else is demonstrable without it |
| 2 | Server-side RBAC on every mutation | The entire product *is* an approval matrix; unenforced roles = no product |
| 3 | Master data: Projects, Sites, Vendors, Users | Required inputs for every document |
| 4 | **Material Request → Manager Approval → Cost Comparison → Purchase Order → Delivery Challan → GRN** | This is the spine. All of it, working, on real data |
| 5 | Approve / Reject / Query on MR, CC, PO — with notes | The approval matrix you were asked to deliver |
| 6 | Auto-fill chain (CC→PO→DC), no re-typing | Named as a hard rule in `project-overview.md` |
| 7 | Universal Document Form (one component, all 6 doc types) | Build once, get six screens. Highest-leverage code in the repo |
| 8 | Audit log — every state transition, actor, timestamp, ref ID | Explicitly a business goal; ~90 min if built into the transition helper on day 2 |
| 9 | GRN auto-generation + photo upload on "Delivered" | Closes the loop; without it the flow has no terminus |
| 10 | Light/dark theme from `theme-rules.md` tokens | Already fully specified — it's config, not design work |
| 11 | Deploy: Convex prod + Vercel, seeded demo data | "Production-deployed" is in your brief |

### ❌ CUT — explicitly deferred to Sprint 2

| Deferred | Reason |
|---|---|
| **RFQ + WhatsApp/email send flow** | The *document* is cheap; the send/receive-quotes loop is not. CC can be created directly from an approved MR for now |
| **Path 1 "Send to Procurement" three-way routing** | Genuinely the differentiating feature — and genuinely a full day with the BOQ item list, multi-select, and three auto-fill targets. Build it on a stable spine, not into a moving one |
| **Partial delivery + Pending POs** | Quantity-remainder maths across DC records is a bug farm. Day-4 stretch goal only |
| **Chat, notifications, inventory, n8n** | Phase 3/5 in your own roadmap |
| **PDF generation (jsPDF)** | Nice-to-have; a print stylesheet gets you 80% of it for 20 minutes |
| **Admin user-management UI** | Seed script + Convex dashboard is fine for 4 days |
| **Manager "bypass approval" toggle** | One boolean, but it doubles the state-machine test surface |
| **Maps, charts, Recharts** | Zero procurement value |

> **The cut-line rule:** if you finish early, you pull items off the CUT list *in the order listed*. You never add anything that isn't on it.

---

## 2. Architect's decision log — three changes to your documented stack

These are deliberate deviations from `tech-stack.md`. Each buys back hours you do not have.

### D1 — Auth: **Convex Auth (Password provider)**, not hand-rolled JWT

`tech-stack.md` says "JWT (custom) or Clerk". Hand-rolled JWT is the trap here. For `ctx.auth.getUserIdentity()` to work inside Convex functions, Convex needs a configured JWT issuer with a reachable JWKS endpoint — so "custom JWT" really means *you build and host an identity provider*. That's 4–6 hours of infrastructure that renders zero pixels.

[Convex Auth](https://labs.convex.dev/auth) ships a [Password provider](https://labs.convex.dev/auth/config/passwords), and the [Convex docs](https://docs.convex.dev/auth) describe it as "the quickest way to get auth up and running."

**Caveat you must know:** Convex Auth is still officially **beta**, and your spec says *no self-registration — Admin creates users*. Convex Auth's password flow is signup-oriented, so you'll create users through an internal mutation and simply never expose a signup route.

> **Day 1, hour 1 is a 45-minute spike on exactly this.** If admin-provisioned password users fight you, you stop and switch to **Clerk** (invitation-based, solves admin-creates-user natively) and lose ~1 hour, not 6. Do not be at hour 3 still fighting auth.

### D2 — File storage: **Convex built-in storage**, not Cloudflare R2 (for this sprint)

GRN unloading photos are the only uploads in scope. Convex's [built-in file storage](https://docs.convex.dev/file-storage/overview) is `generateUploadUrl()` → POST → store the ID. R2 means presigned URLs, CORS config, and an env-var round trip.

There's an official [`@convex-dev/r2` component](https://www.convex.dev/components/cloudflare-r2) that makes the migration a contained swap *after* the sprint. Take the free path now; keep R2 in the architecture for when photo volume actually matters.

### D3 — Schema is **generated from the JSON contracts**, never hand-written

This is the single highest-leverage decision in the sprint, and it's already implied by your own README. One Node script reads `contracts/*.json` and emits `convex/schema.ts` (validators + indexes) and `lib/schemas/*.ts` (Zod). ~2 hours to build, and it pays for itself across 13 tables — and again every time a field changes on day 3 at hour 8, which it will.

**Corollary:** you never edit `convex/schema.ts` by hand. Ever. It carries a `// GENERATED — do not edit` header.

### D4 — One state-transition helper owns every status change

Every approve/reject/query on every document routes through a single `transition()` mutation helper that: checks the role, validates the transition against the contract's `statuses`, writes the new status, and writes the audit-log row. **Audit logging becomes free** instead of being 13 places you forget.

---

## 3. What I hand you before hour 0

So that day 1 is pure implementation:

1. **This plan**
2. **The HTML prototype** — all key screens, real theme tokens, light/dark. This is your design-approval artifact. Approve or redline it *before* day 1 starts, so zero sprint hours go to design exploration
3. **All 13 JSON contracts**, filled out
4. **The codegen script**

That's most of Phase 1 done off the clock.

---

## 4. The 40 hours

**Legend:** 🔴 = hard gate, do not proceed past it broken. ⏱ = hard time-box, abandon and fall back when it expires.

---

### DAY 1 — Foundation & backend spine (10 h)

*Goal at end of day: you can log in as 4 different users and see role-correct empty dashboards, backed by a real generated schema, on a live URL.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–0.5 | Repo audit. Scaffold if empty: `create-next-app` (TS, Tailwind, App Router), `npm i convex`, `npx convex dev`, `.gitignore`, first commit | `localhost:3000` boots, Convex connected |
| 0.5–1.5 | ⏱ **AUTH SPIKE.** Convex Auth + Password. Create one user via internal mutation, log in, read identity inside a query. **Timer expires at 1.5 → switch to Clerk, no debate** | 🔴 A Convex query returns the logged-in user's role |
| 1.5–2.5 | Drop in contracts, run codegen, push schema | All 13 tables visible in the Convex dashboard |
| 2.5–4.0 | `lib/rbac.ts` + `requireRole()` guard. Wire into a throwaway mutation and prove a Site Supervisor is rejected | 🔴 Unauthorized role throws server-side |
| 4.0–5.0 | Seed script: 1 project, 2 sites, 5 vendors, 4 users (one per role), 20 BOQ items | `npx convex run seed:all` populates everything |
| 5.0–6.0 | App shell: root layout, theme provider, CSS variables from `theme-rules.md`, dark toggle | Toggle flips the whole app; no hardcoded hex anywhere |
| 6.0–7.5 | Sidebar + header + role-based nav (Procurement / Supply sections per spec) | Each role sees only their permitted nav items |
| 7.5–9.0 | Login page + 4 role dashboard routes (empty-state cards) | Login redirects each role to the right dashboard |
| 9.0–9.5 | Deploy to Vercel + Convex prod **on day 1** | 🔴 A live URL exists. Deploying on day 4 is how sprints die |
| 9.5–10.0 | Commit, push, write tomorrow's first task at the top of your notes | Clean git state |

**Day 1 gate:** live URL, 4 logins, role-correct nav, generated schema.
*If auth isn't done by hour 3, the sprint is already in trouble — cut Cost Comparison that evening, not on day 4.*

---

### DAY 2 — Document engine + the request half of the pipeline (10 h)

*Goal at end of day: a Site Supervisor creates a Material Request; a Project Manager approves, rejects, or queries it. Real data, real audit rows.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–2.0 | **Universal Document Form** — reads a contract, renders fields by `input` type (text, number, select, autocomplete, date, textarea, item-list, readonly-badge, file) | One component renders the MR form from JSON alone |
| 2.0–3.0 | `ItemListInput` — add/remove/edit line items. The fiddliest control in the app; do it once, reuse 5× | Add 3 items, remove the middle one, values stay correct |
| 3.0–4.0 | `transition()` helper + `logs` writer (**D4**) | Every status change writes an audit row automatically |
| 4.0–5.5 | Material Request: create + list + detail. Convex mutations with Zod-validated input | Supervisor creates an MR; it appears in their list live |
| 5.5–7.0 | Manager approval queue + Approve / Reject / Query with notes modal | MR moves `pending → ready_for_cc` / `rejected` / `queried` |
| 7.0–8.0 | Status badge system + list/table component (reused by all 6 doc types) | Badges match `theme-rules.md` §4 in both modes |
| 8.0–9.0 | Query→resubmit loop: supervisor edits a queried MR and resubmits | Round trip works; both transitions in the audit log |
| 9.0–9.5 | Deploy + smoke test on the live URL, not localhost | Live URL shows the working MR flow |
| 9.5–10.0 | Commit, push | — |

**Day 2 gate:** 🔴 MR lifecycle complete on production.
**This is the make-or-break day** — the document engine built here is what makes days 3 and 4 fast. If the Universal Form isn't working by hour 4, stop building it generically and hand-write the MR form; generalise in Sprint 2.

---

### DAY 3 — The procurement half (10 h)

*Goal at end of day: approved MR → Cost Comparison → vendor selected → Purchase Order → approved.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–2.0 | Cost Comparison: create from approved MR, items auto-filled, add ≥2 vendor quotes | Min-2-quotes rule enforced server-side, not just in the form |
| 2.0–3.5 | CC side-by-side comparison view + Manager approves *with vendor selection* | Approve requires picking a vendor; `→ ready_for_po` |
| 3.5–4.5 | CC query / reject paths | Both transitions logged; rejected CCs filterable |
| 4.5–6.5 | Purchase Order: auto-filled from approved CC (vendor + line items + rates), submit → `review_po` | 🔴 Zero manual re-entry from CC to PO |
| 6.5–7.5 | PO approve / query / reject | `→ pending_po` on approval |
| 7.5–8.5 | Vendor management CRUD + name-uniqueness check | Add / edit / deactivate a vendor |
| 8.5–9.0 | Procurement Officer dashboard: pipeline stage counts | Live counts at each stage |
| 9.0–9.5 | Deploy + smoke test | — |
| 9.5–10.0 | Commit, push, **honest scope review**: what's actually left for day 4? | Written list |

**Day 3 gate:** MR → CC → PO working with the auto-fill chain intact.

> **Day 3 hour 10 is your last honest re-scope point.** If PO isn't done, drop Delivery Challan's polish and go straight to a minimal DC → GRN on day 4. Ending with a pipeline that stops at PO is far worse than one with an ugly delivery screen.

---

### DAY 4 — Delivery, GRN, hardening, ship (10 h)

*Goal at end of day: the loop closes, and it's production-hard.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–1.5 | Delivery Challan from approved PO (vehicle, driver, items, expected arrival) → `delivery_processing` | Site Supervisor sees "Out for Delivery" |
| 1.5–3.0 | **"Delivered" → auto-GRN** + photo upload (Convex storage, **D2**). GRN is generated, never a form | GRN row auto-created with all fields per `project-overview.md` |
| 3.0–4.0 | GRN list view + Logs page with reference-ID links back to source documents | Click any log row → lands on the document |
| 4.0–5.5 | 🔴 **Security pass.** Re-audit *every* mutation for `requireRole()`. Confirm no client-trusted role. Confirm no Convex function is unguarded-public. `npm audit --audit-level=high` | Write down every mutation and tick it off — do not eyeball this |
| 5.5–7.0 | 🔴 **Full end-to-end walkthrough as all 4 roles** on the production URL: MR → approve → CC → select vendor → PO → approve → DC → delivered → GRN. Fix what breaks | One clean run, start to finish, no console errors |
| 7.0–8.0 | Empty states, loading states, error boundaries, 404s. Mobile check on the site-supervisor screens (they're used on-site, on phones) | No raw spinners or blank screens on any route |
| 8.0–9.0 | **Buffer.** It will be consumed — plan for that, don't plan work into it | — |
| 9.0–9.5 | Final deploy, seed production demo data, tag `v1.0.0` | — |
| 9.5–10.0 | Write `HANDOVER.md`: what shipped, what's stubbed, known issues, Sprint 2 order | — |

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Convex Auth beta fights admin-created users** | Medium | High | ⏱ 45-min hard time-box on day 1, then Clerk. Decided in advance so you don't negotiate with yourself at hour 3 |
| **Universal Document Form over-engineered** | High | High | Day-2 hour-4 checkpoint: if it isn't rendering the MR form, hand-write the forms and generalise later. Generic-first is the classic solo-sprint trap |
| **Auto-fill chain leaks bad data between docs** | Medium | Medium | Snapshot item data into the child document at creation. Do **not** live-join to the parent — approved quantities must not change retroactively |
| **Day-4 deploy surprises** | Was high | Was fatal | Neutralised: you deploy on day 1 and after every single day |
| **Scope creep from the CUT list** | Very high | Fatal | The list is written down and dated. Re-read it every morning |
| **10-hour days degrade code quality by day 3** | Certain | Medium | The security pass on day 4 sits deliberately *after* the fatigue, not before |

---

## 6. Definition of done (v1.0)

- [ ] Live production URL, custom-domain-ready
- [ ] 4 roles log in and land on role-correct dashboards
- [ ] A Site Supervisor's Material Request can travel the full pipeline to GRN without a developer touching the database
- [ ] Every state change appears in the audit log with actor + timestamp + reference ID
- [ ] Every mutation enforces role server-side
- [ ] Light and dark mode both correct on every screen
- [ ] No hardcoded colors anywhere in components
- [ ] No file over 500 lines
- [ ] `HANDOVER.md` written

---

## 7. Sprint 2 backlog (in priority order)

1. RFQ + WhatsApp/email send flow
2. Path 1 "Send to Procurement" three-way routing from the BOQ list
3. Partial delivery + Pending Purchase Orders
4. Admin user-management UI + the manager approval-bypass toggle
5. PDF generation for PO/DC
6. Migrate file storage to Cloudflare R2 via `@convex-dev/r2`
7. Inventory, chat, notifications

---

## 8. Rules for the four days

1. **Deploy every day.** A day that doesn't end on production didn't happen.
2. **Commit every 90 minutes.** Solo sprints have no code review; git history is your only undo.
3. **Never hand-edit generated files.** Change the contract, re-run codegen.
4. **When stuck for 20 minutes, take the ugly path.** Ugly and shipped beats elegant and absent.
5. **Do not refactor during the sprint.** Write it down for Sprint 2 and move on.
6. **Do not start anything new after hour 8 of any day.** Fatigue-written code is day-4 debugging.

---

*Sprint plan v1.0 · Nirman Construction Site ERP · derived from `project-overview.md`, `user-flow.md`, `tech-stack.md`, `theme-rules.md`, `phase-1.md`*
