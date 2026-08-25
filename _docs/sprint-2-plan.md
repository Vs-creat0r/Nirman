# Nirman — Sprint 2 Plan
### Hardening & Completion · 5 days × 10 h = 50 hours

**Sprint Lead / Architect:** Claude
**Builder:** you (solo)
**Baseline:** `06af32a` — Days 1–3 of Sprint 1 shipped; Day 4 did not
**Input:** `claude/nirman-audit-report.md` (6 CRITICAL, 13 HIGH, 26 MEDIUM)
**Target:** a system that can safely hold real vendor data and real money, with the pipeline closed end-to-end.

---

## 0. The call

You asked what Sprint 2 should be. **It is not the Sprint-1 backlog.**

RFQ, Path-1 routing and partial delivery were the planned Sprint 2. They are now **Sprint 3**. Here's why, in one line: the app currently lets any logged-in user approve any purchase order by passing their own allowlist as an argument, and every user's plaintext password is sent to the browser on every page load. Building RFQ on top of that means auditing RFQ too, later, at greater cost.

Sprint 2 does three things, in this order:

1. **Make it safe** — the auth and authorization model, rebuilt properly (Days 1–2).
2. **Make it complete** — Delivery Challan → GRN, so the pipeline has a terminus (Day 3).
3. **Make it stay fixed** — the invariants that lapsed in Sprint 1 become machine-checked in CI (Day 5).

50 hours, not 40. I sized this honestly: the security cluster alone is 14 hours and there is no version of it that is shorter. If you only have 40, cut Day 4 (UI/UX polish), not Day 1 or 2.

### Why hardening comes *before* Delivery Challan

Tempting to build DC/GRN first — it's the visible gap and it demos well. Don't. DC and GRN are ~8 hours of new mutations, and if they're written against today's `token`-as-argument, no-row-scoping pattern, you will audit and rewrite them in Sprint 3. Fix the pattern on Day 1, then write DC/GRN **on** it. Same total hours, half the rework.

---

## 1. Scope

### ✅ SHIP

| # | Item | Source |
|---|---|---|
| 1 | Auth rebuilt: hashed passwords, CSPRNG tokens, httpOnly cookie, rotation, expiry sweep | C2, C4 |
| 2 | `executeTransition` deleted; authorization lists become compile-time constants | **C1** |
| 3 | `passwordHash` stripped at every boundary; `users.list` admin-gated; `seedAll` → `internalMutation` | C3, C5 |
| 4 | Row-level scoping: `assignedProjectIds` / `assignedSiteIds` actually enforced | H7 |
| 5 | Site Supervisor removed from all commercial reads (CC, PO, vendor pricing) | H7 |
| 6 | Server-side route guards + role-aware action buttons (hidden, not disabled) | H8 |
| 7 | The 8 business-rule defects: CC status guard, duplicate-PO lock, CC↔MR quantity validation, `?? 18`, negative-quantity clamp, `resubmitPO` re-validation, payment-terms passthrough, vendor existence check | H2–H6, M3, M4, M8 |
| 8 | All 6 bypassing status changes routed through `transition()` | M1, M2 |
| 9 | **Delivery Challan → "Delivered" → auto-GRN + mandatory photo upload** | Sprint-1 Day 4 |
| 10 | System Logs page + the 4 other 404'd nav routes resolved | H12 |
| 11 | Contract-first restored: `tc_templates` contract, `npm run gen`, `gen:check` in CI | **H9** |
| 12 | `--color-card` / `--color-input` / `--color-ring` defined; modals and inputs render | **C6** |
| 13 | "Submit for Approval" actually submits | **H1** |
| 14 | Status badges use `--status-*` tokens; the 13 AA-failing controls fixed | M15, M16 |
| 15 | `logs` index + the 4 full-table scans removed | H10 |
| 16 | Item-list input usable on a 375px phone | H11 |
| 17 | Universal read-only document detail shell (~2,400 lines → ~600) | H13 |
| 18 | Test harness + CI: role matrix, transition matrix, `gen:check`, smoke E2E | M23 |
| 19 | `HANDOVER.md` | Sprint-1 DoD |

### ❌ CUT — to Sprint 3

| Deferred | Reason |
|---|---|
| **RFQ + WhatsApp/email send flow** | Unchanged from Sprint 1. Do not build it on an unfixed base |
| **Path 1 "Send to Procurement" routing** | Still the differentiating feature; still a full day; still wants a stable spine |
| **Partial delivery + Pending POs** | Quantity-remainder maths. Needs a *correct* PO first — see H4/H5 |
| **Inventory module** | Nav links exist; module doesn't. Stub the route, don't build it |
| **Admin user-management UI** | Convex dashboard + seed still fine |
| **Wiring CC/PO through the Universal *edit* Form** | The read-only detail shell (#17) captures most of the value at a fraction of the risk. Full contract-driven CC/PO editing is a Sprint-3 decision |
| **PDF generation, chat, notifications, n8n** | Unchanged |

> **Cut-line rule, restated:** if you finish early you pull from this list *in order*. Nothing enters that isn't on it.

---

## 2. Architect's decisions for Sprint 2

### D5 — Auth: managed provider, and this time the time-box is enforced

Sprint 1's D1 said Convex Auth with a 45-minute fallback to Clerk. What shipped was neither — hand-rolled sessions, which is what the decision existed to prevent. Both packages are still in `package.json`, unused.

**Decision: Clerk.** Not Convex Auth. Reasons: (a) it solves admin-provisioned users natively via invitations, which is your actual requirement and was the exact friction that pushed you off Convex Auth; (b) it is GA, not beta; (c) `@clerk/nextjs` is already installed; (d) it gives you `middleware.ts` route protection for free, which fixes H8's server half in about twenty minutes.

Convex reads identity through `ctx.auth.getUserIdentity()` — **no token argument, ever.** That single change kills C1, C4, and the whole class of "did this function remember to take a token" bugs.

**⏱ Hard time-box: 2.5 hours.** If Clerk isn't authenticating a Convex query by hour 2.5, stop and do the minimum viable fix on the existing system instead — scrypt hashing, `crypto.randomUUID()` tokens, httpOnly cookie, strip `passwordHash` — which is ~3 hours and closes C2/C3/C4 without closing C1's root cause. Decide at 2.5. Do not negotiate at hour 5.

### D6 — Authorization is data, and it lives in one file

Today, allowed-roles arrays are inline literals at ~25 call sites, and one of them is a client argument. Replace with a single `convex/permissions.ts`:

```ts
export const PERMISSIONS = {
  "cost_comparison.approve": ["project_manager", "admin"],
  "cost_comparison.create":  ["procurement_officer", "project_manager", "admin"],
  // …
} as const;
```

Every guard becomes `await require(ctx, "cost_comparison.approve")`. Three payoffs: the policy is readable in one screen, it cannot be supplied by a caller, and **it is testable** — one test iterates the matrix and asserts every role × every action. That test is what stops Sprint-1's erosion from recurring.

### D7 — Scoping is a query concern, not a page concern

Add one helper — `scopedQuery(ctx, table, user)` — that applies `assignedProjectIds` / `assignedSiteIds` filtering before anything else, and route every list and get through it. Row-level access must not be something each of 15 queries remembers independently; that is how H7 happened.

### D8 — GRN is generated, never submitted

Restating the business rule because Sprint 2 is where it gets implemented: GRN is **not a form**. It is created by the DC's "Delivered" transition, inside the same mutation, with the photo upload as a precondition — no photo, no transition, no GRN. If a GRN can ever exist without a DC transition that produced it, the implementation is wrong.

### D9 — The invariants become CI, or they lapse again

Sprint 1 documented eight non-negotiable rules. Six are broken today, and every one broke *silently*. Documentation did not hold. Day 5 makes five of them executable:

| Rule | Enforcement |
|---|---|
| Never hand-edit generated files | `npm run gen:check` — non-zero exit on drift |
| Every mutation enforces role server-side | Role-matrix test over `PERMISSIONS` |
| Every state change writes an audit row | Transition-matrix test asserting `logs` count delta |
| Files ≤ 500 lines | Lint rule |
| No `any`, no relative imports | `@typescript-eslint/no-explicit-any` + `no-restricted-imports`, errors not warnings |

---

## 3. The 50 hours

**Legend:** 🔴 hard gate — do not proceed past it broken. ⏱ hard time-box.

---

### DAY 1 — Authentication & the authorization model (10 h)

*Goal: nobody can act as anyone else, and the policy lives in one file.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–0.5 | **Delete `executeTransition`'s public export** (`transition.ts:125`). Keep the internal helper. Ship this alone, first, before anything else | 🔴 **C1 closed** — the single most severe finding, and a 6-line fix |
| 0.5–3.0 | ⏱ **Clerk integration.** Provider, `middleware.ts` route protection, `ctx.auth.getUserIdentity()` reading inside a Convex query, `users` mapped by `clerkId`. **Timer expires at 3.0 → fall back to D5's hardening path, no debate** | 🔴 A Convex query returns the caller's role with **no token argument** |
| 3.0–4.0 | Migrate all 4 seeded users to the new provider. Delete `sessions` table, `auth.ts`, `passwordHash`, `AuthProvider`'s localStorage | 🔴 `grep -r passwordHash` returns nothing. **C2, C3, C4 closed** |
| 4.0–5.0 | `seedAll` → `internalMutation`. `users.list` → admin only. Strip user documents at the boundary — one serializer, used everywhere | **C5 closed**; no user doc leaves the server with secrets on it |
| 5.0–7.0 | **`convex/permissions.ts`** (D6). Migrate all ~25 guards to `require(ctx, action)` | Zero inline role arrays remain outside `permissions.ts` |
| 7.0–8.5 | **Role-matrix test** — every role × every action, asserting allow/deny | 🔴 Test is green and **fails** if you widen any permission |
| 8.5–9.0 | Remove `site_supervisor` from `listCCs`, `getCC`, `listPOs`, `getPO`, and all 4 vendor reads | Supervisor gets a clean 403, not a price list |
| 9.0–9.5 | Deploy + verify all 4 roles log in on the live URL | Live |
| 9.5–10.0 | Commit, push | Clean |

**Day 1 gate:** 🔴 no plaintext credentials anywhere; no client-supplied authorization; the permission matrix is under test.
*If Clerk fails at hour 3, you take the fallback and still finish Day 1 on time. That is what the time-box is for.*

---

### DAY 2 — Scoping, business rules, audit integrity (10 h)

*Goal: the data is correct, and every change to it is recorded.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–2.0 | **`scopedQuery` helper** (D7). Route every list and get through it. `assignedProjectIds` / `assignedSiteIds` finally do something | 🔴 A user cannot fetch a document from a project they aren't assigned to — **by ID** |
| 2.0–2.5 | IDOR sweep: `getMR`, `getCC`, `getPO`, `getDocumentLogs`, `getVendorDetails` | Each verified by hand with a foreign ID |
| 2.5–4.0 | **Business-rule fixes, batch 1.** CC status guard (H2); duplicate-PO lock (H4); `?? 18` (H5); negative-quantity clamp (H6); vendor existence + `isActive` check (M8) | Each has a test that fails without the fix |
| 4.0–5.5 | **Business-rule fixes, batch 2.** CC quantities validated against the parent MR (H3); `resubmitPO` re-validated against its CC (M3); payment terms passed through, not mapped away (M4); `createCC`'s `"" as any` siteId (M5) | 🔴 A CC cannot exceed approved MR quantities |
| 5.5–7.0 | Route all 6 bypassing status changes through `transition()` (M2). Add `from`-guards. Fix `submitPO`'s silent transition (M1) | 🔴 Every `status` write in `convex/` goes through the helper — verified by grep |
| 7.0–8.0 | **Transition-matrix test** — every documented transition, asserting the status moves *and* a `logs` row appears | Green; fails if a status write skips the helper |
| 8.0–8.5 | Audit rows for `updateVendor`, `deactivateVendor`, `updateCompanyProfile` (M7) | Vendor deactivation is traceable |
| 8.5–9.0 | Enforce `requireManagerApprovalForRequests`, or delete the setting and its UI (M6) | The toggle does what it says, or it's gone |
| 9.0–9.5 | Deploy + smoke test | Live |
| 9.5–10.0 | Commit, push | — |

**Day 2 gate:** 🔴 the security cluster is closed. Now — and only now — is it worth adding surface area.

---

### DAY 3 — Delivery Challan → GRN: close the pipeline (10 h)

*Goal: a Material Request travels all the way to a signed-for receipt.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–0.5 | `contracts/tc_templates.json`; `node scripts/generate-from-contracts.mjs` runs clean; add `"gen"` and `"gen:check"` to `package.json` | 🔴 **H9 closed** — codegen works again; `git diff` after regen is empty |
| 0.5–2.5 | **`convex/delivery_challan.ts`** — create from approved PO (vehicle, driver, items, expected arrival), snapshot line items, `→ delivery_processing`. Written on Day 1's auth and Day 2's scoping from the first line | PO → DC with zero re-entry |
| 2.5–4.0 | DC create + list + detail UI. Supervisor sees **"Out for Delivery"** on their dashboard | Supervisor's screen changes without a refresh |
| 4.0–5.0 | **Photo upload** — `generateUploadUrl()` → POST → `v.id("_storage")`. Camera capture on mobile (`capture="environment"`). This is D2's first real test | Photo uploads from a phone |
| 5.0–7.0 | 🔴 **"Delivered" → auto-GRN** (D8). One mutation: validate photo present → create GRN → transition DC → transition PO → write both audit rows. Atomic | 🔴 GRN cannot exist without a DC transition; transition cannot happen without a photo |
| 7.0–8.0 | GRN list + detail with photo gallery | Click a GRN, see what arrived |
| 8.0–9.0 | **System Logs page** with reference-ID links back to source documents. Stub or resolve the remaining 404 nav routes (H12) | Click any log row → land on the document. No nav item 404s |
| 9.0–9.5 | 🔴 **First full end-to-end run on production:** MR → approve → CC → select vendor → PO → approve → DC → delivered → GRN | One clean run, four roles, no console errors |
| 9.5–10.0 | Commit, push, honest scope review for Days 4–5 | Written list |

**Day 3 gate:** 🔴 the pipeline has a terminus. **This is the day the product becomes a product** — everything before it was making the existing half safe.

---

### DAY 4 — The UI debt (10 h)

*Goal: it looks and behaves like the thing you designed, in both themes, on a phone.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–0.5 | Define `--color-card`, `--color-input`, `--color-ring` in `@theme` | 🔴 **C6 closed.** Every modal and input in the app becomes visible. Start here — it's 3 lines and it unblocks judging everything else |
| 0.5–1.0 | Fix "Submit for Approval" — pass `submitImmediately` through state, delete the DOM `.click()` (H1) | 🔴 A submitted MR reaches the manager's queue |
| 1.0–2.5 | Rewrite `status-badge.tsx` against `--status-*`. The tokens already exist with full dark overrides — this is deletion, not authoring (M15) | Badges correct in both themes; `themes.css` stops being dead code |
| 2.5–4.0 | Fix the 13 AA-failing controls (M16). Approve / Authorize / Generate PO / Edit & Resubmit → `--success` and `--warning` with correct foregrounds | 🔴 Every interactive control ≥ 4.5:1 in both themes |
| 4.0–5.0 | Sweep the remaining ~200 hardcoded colors to tokens, worst files first: `procurement/page.tsx` (63) | `grep -E "(bg\|text)-(emerald\|amber\|rose)-[0-9]"` in `app/` returns nothing |
| 5.0–6.5 | **Universal read-only document detail shell** (H13). Six near-identical pages, ~2,400 lines → ~600. Start with `audit-log-timeline`, duplicated verbatim in all six | Six detail pages, one shell |
| 6.5–8.0 | Mobile: item-list input as cards below `sm`, 44px targets, 16px inputs to stop iOS auto-zoom (H11) | 🔴 A supervisor can file a request on a 375px phone without horizontal scrolling |
| 8.0–9.0 | Loading vs empty states (M12); sidebar's supervisor-nav default (M13); deep-link redirect (M14); `error.tsx` + `not-found.tsx` + `loading.tsx`; the 5 hand-rolled modals → Radix (M17); `key={idx}` splice bug (M18) | No route shows a raw spinner, a wrong menu, or a bare 404 |
| 9.0–9.5 | Deploy + smoke test | Live |
| 9.5–10.0 | Commit, push | — |

**Day 4 gate:** light and dark correct on every screen; supervisor flow works on a phone.
*This is the cuttable day. If Days 1–3 overran, take hours 0.0–4.0 — the theme tokens, the submit bug and the contrast fixes — and drop the rest to Sprint 3.*

---

### DAY 5 — Make it stay fixed, then ship (10 h)

*Goal: the invariants are executable, and the next sprint can't silently break them.*

| Hours | Task | Done when |
|---|---|---|
| 0.0–1.5 | **CI** (D9): GitHub Actions — `gen:check`, typecheck, lint, the two matrix tests. Branch protection on `main` | 🔴 A PR that hand-edits `schema.ts` fails CI |
| 1.5–2.5 | Lint rules as **errors**: `no-explicit-any`, `no-restricted-imports` (relative), 500-line cap. Fix or `// eslint-disable` with a reason — no silent debt | `npm run lint` is clean |
| 2.5–4.0 | **Performance.** `by_documentId` index on `logs`; kill the 4 full-table scans (H10); paginate the dashboard's log slice; index `listProjectItems` (M11); fix the worst N+1s in `listPOs` / `listCCs` (M10) | 🔴 No unbounded `.collect()` on `logs`, `purchase_order` or `cost_comparison` |
| 4.0–5.0 | `refNo` generation off the full-table scan; uniqueness re-check before insert (M9) | Two concurrent creates produce two distinct refNos |
| 5.0–6.0 | **Smoke E2E** (Playwright): the full pipeline as all 4 roles, one spec | Green in CI |
| 6.0–7.0 | 🔴 **Security re-audit.** Walk every mutation and query against `permissions.ts` and tick it off on paper. Re-verify C1–C5 are closed. `npm audit --audit-level=high`. Confirm no `passwordHash`, no token arguments, no unguarded public functions | Written checklist, every line ticked. **Do not eyeball this** |
| 7.0–8.0 | Cleanup: delete `nirman-setup/` (M25); remove `@convex-dev/auth` if unused (M24); `alert()`/`confirm()` → themed dialogs (M21) | One copy of the contracts; no dead deps |
| 8.0–9.0 | **Buffer.** It will be consumed. Do not plan work into it | — |
| 9.0–9.5 | Final deploy, re-seed production, tag `v1.1.0` | — |
| 9.5–10.0 | **`HANDOVER.md`** — what shipped, what's stubbed, known issues, Sprint 3 order | 🔴 Written. It was Sprint 1's last unmet DoD item; don't miss it twice |

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Clerk migration overruns and eats Day 1** | Medium | High | ⏱ 2.5 h, decided in advance, with a costed fallback that still closes C2–C4. The Sprint-1 lesson is that the time-box only works if the fallback is chosen *before* you're tired |
| **Auth migration orphans existing documents** | Medium | High | `users` keeps its `_id`; only the identity link changes. Migrate the 4 seeded users first and verify `createdBy` still resolves on an existing MR before touching anything else |
| **Adding row-level scoping breaks working screens** | High | Medium | Expected, and cheap to diagnose. Ship scoping on Day 2 morning so you have the full day to find what it hid. A screen that goes empty is scoping working — check assignments first, and only then suspect the helper |
| **"Just one more feature" pressure** | High | Fatal | The CUT list is dated and written down. Re-read it every morning. **Three of four architect decisions were reversed on Day 3 of Sprint 1 — the fastest, most productive day.** Speed didn't cost features; it cost invariants |
| **Day 4's colour sweep is boring and gets abandoned** | Medium | Low | Sequenced deliberately: tokens, the submit bug and contrast fixes come first (hours 0–4). If motivation fails after that, you've already banked everything that matters |
| **The security re-audit gets skipped because it's Day 5 hour 6** | Medium | High | It sits before the buffer, not after — same placement as Sprint 1's Day 4. Protect it. It is the only step that verifies Days 1–2 actually held |
| **Codegen restoration reveals wider schema drift** | Medium | Medium | Day 3 hour 0. If `git diff` after regen is larger than the `tc_templates` addition, stop and reconcile before building DC — do not layer new tables on a schema you can't regenerate |

---

## 5. Definition of done (v1.1)

**Security**
- [ ] No plaintext credential anywhere in the codebase or database
- [ ] No authorization decision derived from a client-supplied value
- [ ] Every mutation and query guarded via `permissions.ts`; role matrix under test
- [ ] Row-level scoping enforced — no cross-project reads by ID
- [ ] `seedAll` and all admin functions are internal or admin-gated
- [ ] `npm audit --audit-level=high` clean

**Completeness**
- [ ] MR → Approval → CC → PO → DC → **GRN** runs end-to-end on production, as all 4 roles
- [ ] GRN auto-generates on "Delivered" with a mandatory photo, and cannot be created any other way
- [ ] Every state change writes an audit row with actor, timestamp, reference ID
- [ ] No nav item 404s
- [ ] System Logs page links back to source documents

**Quality**
- [ ] `npm run gen:check` clean — generated files match contracts
- [ ] Light and dark correct on every screen; no hardcoded colors in `app/` or `components/`
- [ ] Every interactive control ≥ 4.5:1 contrast in both themes
- [ ] Supervisor flow usable on a 375px phone
- [ ] No file over 500 lines; no `any`; no relative imports
- [ ] CI green on `main`; branch protection on
- [ ] Smoke E2E passes
- [ ] `HANDOVER.md` written

---

## 6. Sprint 3 backlog (in priority order)

1. RFQ + WhatsApp/email send flow
2. Path 1 "Send to Procurement" three-way routing from the BOQ list
3. Partial delivery + Pending Purchase Orders
4. Inventory module (nav links exist today and go nowhere)
5. Admin user-management UI + manager approval-bypass toggle
6. PDF generation for PO / DC
7. Wiring CC and PO through the Universal *edit* Form — or formally retiring the rule
8. Migrate file storage to Cloudflare R2 via `@convex-dev/r2`
9. Chat, notifications, n8n

---

## 7. Rules for the five days

1. **Deploy every day.** Unchanged, and it worked — you have a live URL because of it.
2. **Commit every 90 minutes.**
3. **Never hand-edit generated files.** This one lapsed in Sprint 1 and cost you the architecture. Day 5 makes it CI's problem, not yours.
4. **When stuck for 20 minutes, take the ugly path** — *except in Days 1–2.* Security is the one place where ugly-but-shipped is the wrong trade. There, stop and ask.
5. **Do not refactor opportunistically.** Day 4 hour 5.0–6.5 is the *only* scheduled refactor. Everything else goes on the Sprint 3 list.
6. **Do not start anything new after hour 8.**
7. **A fix without a test that would have caught it is half a fix** — for anything in the CRITICAL or HIGH list.

---

*Sprint 2 plan v1.0 · Nirman Construction Site ERP · derived from the repository audit of `06af32a` and `claude/sprint-1-plan.md`*
