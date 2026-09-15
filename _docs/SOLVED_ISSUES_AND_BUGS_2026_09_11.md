# 📋 Solved Issues & Bug Fixes Report — 11 September 2026

> **Project**: NOTION Procurement & Construction ERP (Next.js + Convex)  
> **Date**: 11 September 2026  
> **Branch**: `fix/lifecycle-submit-resubmit`  
> **Test Status**: ✅ 711/711 tests passing (21 test suites)  
> **Typecheck Status**: ✅ `npx tsc --noEmit` — 0 errors  
> **Gate 3 Invariant Status**: ✅ 100% Green  

---

## 🗂️ Summary of Solved Issues Today

| # | Issue / Bug Description | Type | Component / Module | Status |
|---|---|---|---|---|
| **01** | Site Engineer / Supervisor "Save Draft" not available when editing an existing draft or queried Material Request | Functional Bug / Missing Feature | `convex/material_requests.ts`<br>`app/(dashboard)/dashboard/supervisor/material-requests/[id]/edit/page.tsx` | ✅ Resolved |
| **02** | Unauthorized Project Manager action buttons ("Approve", "Reject", "Query") displayed on Site Supervisor's page | UI / Access Control Bug | `components/document/document-view.tsx` | ✅ Resolved |
| **03** | Button contrast and styling washed out / unreadable in Light Theme | UI / Theme Bug | `components/document/document-view.tsx` | ✅ Resolved |
| **04** | Agent auto-committing / auto-pushing to Git without explicit user approval | Workflow / Agent Guardrail | `AGENTS.md`<br>`CLAUDE.md`<br>`_docs/agent-rules.md`<br>`Build guide/_docs/agent-rules.md` | ✅ Enforced & Codified |
| **05** | Turbopack Build Error: `the name 'actions' is defined multiple times` | Syntax / Build Error | `components/document/document-view.tsx:243:9` | ✅ Resolved |
| **06** | Convex Runtime Crash on GRN Detail Page: `Lifecycle machine not found for table "grn"` | Runtime Exception | `components/document/document-view.tsx`<br>`convex/lifecycle/actions.ts` | ✅ Resolved |
| **07** | Syntax Error in `document-view.tsx`: `Expected ',', got 'ident'` at line 188 | Parse / Build Error | `components/document/document-view.tsx:188:5` | ✅ Resolved |

---

## 🔍 Detailed Issue Reports

### Issue #01 — Supervisor MR Edit: Missing "Save Draft" and "Save Changes"

#### Problem & Context
When a Site Supervisor created a draft or had an MR queried by a manager, clicking edit led to a page where only a single "Submit" action was available. The user reported:
> *"Save draft is not available after user submitted for draft and while editing that draft."*

Users could not update items, notes, or department without prematurely advancing the state machine to `pending`. Furthermore, the backend lacked a mutation to update MR content without changing its lifecycle status.

#### Root Cause
1. In `app/(dashboard)/dashboard/supervisor/material-requests/[id]/edit/page.tsx`, the submission handler exclusively dispatched `api.lifecycle.executeAction` with action `"submit"` or `"resubmit"`.
2. Convex backend lacked a dedicated `updateMR` mutation. All writes were previously forced through `executeAction` (which transitions states).

#### Fix Applied
1. **Created `updateMR` Mutation (`convex/material_requests.ts`)**:
   - Accepts: `mrId`, `department`, `priority`, `requiredByDate`, `notes`, `items`.
   - Authorization: Verifies token, ensures user is authenticated with `site_supervisor`, `project_manager`, or `admin` role.
   - Status Check: Only allows updating MRs in `draft` or `queried` status.
   - Audit Logging: Inserts a compliant audit entry into the `logs` table adhering to the schema (`actorId`, `actorRole`, `action: "update"`, `documentType: "material_request"`, `documentId`, `referenceId`, `fromStatus`, `toStatus`, `timestamp`).
2. **Updated Edit Form (`app/(dashboard)/dashboard/supervisor/material-requests/[id]/edit/page.tsx`)**:
   - Added dual-action buttons:
     - **Save Draft / Save Changes**: Invokes `api.material_requests.updateMR` without altering the lifecycle state.
     - **Submit for Approval / Resubmit**: Saves changes first, then executes the lifecycle transition (`submit` or `resubmit`).
3. **Parity Tests**:
   - Added `updateMR: "material_requests:update"` to `tests/mutation_wiring.test.ts`.

---

### Issue #02 — Unauthorized Manager Action Buttons Visible to Site Supervisor

#### Problem & Context
On the Site Supervisor's Material Request and document detail views, buttons for manager-only transitions ("Approve", "Reject", "Query") were showing up as disabled buttons. The user reported:
> *"These buttons should not be visibled to here as this is supervisor's page and in professionalism of in production this should not be showned."*

#### Root Cause
In `components/document/document-view.tsx`, the query `api.lifecycle.availableActions` evaluates all transitions defined in the state machine for the current document status. If a transition is valid from that state but the caller's role is not permitted, `computeAvailableActions` returns the item with `enabled: false` and `reason: "Requires role: project_manager, admin"`.  
The UI was rendering disabled buttons with tooltips for these actions, which cluttered the supervisor interface with actions they are never authorized to execute.

#### Fix Applied
In `components/document/document-view.tsx`, filtered out actions where the user lacks the required role:
```tsx
const actions = (availableActionsData?.actions || []).filter((action) => {
  if (action.reason?.startsWith("Requires role")) return false;
  return true;
});
```
Actions that require a different role are completely excluded from the UI, keeping the view clean, professional, and role-appropriate. Actions that the user *can* perform but are blocked due to unmet guards or missing fields remain visible with helpful guidance. Added test assertion in `tests/ui_action_parity.test.ts`.

---

### Issue #03 — Light Theme Button Contrast & Styling

#### Problem & Context
In the light theme, the action buttons in `DocumentView` had low contrast and poor visual separation against the white background.

#### Root Cause
Button variant classes lacked explicit light-mode borders and text color tokens, relying on defaults that rendered poorly in bright mode.

#### Fix Applied
Updated button styling in `components/document/document-view.tsx` with high-contrast, theme-aware tokens:
```tsx
className="border-input hover:bg-accent/80 dark:border-muted-foreground/30 text-foreground font-medium shadow-sm transition-colors"
```
Ensured proper contrast, hover states, and accessibility across both Light and Dark themes.

---

### Issue #04 — Strict Git & Deployment Rules Codified

#### Problem & Context
The AI assistant previously performed git commits and pushes autonomously. The user instructed:
> *"Dont directly commut or push into github next time rather then I specifically tell into chat. Make this rule. This is the bed habbit"*

#### Resolution & Rule Enforcement
Codified the strict rule across all agent instruction files:
- `AGENTS.md`
- `CLAUDE.md`
- `_docs/agent-rules.md`
- `Build guide/_docs/agent-rules.md`
- `Build guide/_Obsidian Brain/agent-rules.md`
- `Build guide/zClaude Project Files/antigravity-standing-rules.md`

**Standing Rule**:
> **NEVER directly commit (`git commit`) or push (`git push`) to GitHub / git remote automatically.**  
> Only commit or push when the user explicitly instructs you to do so in the chat.  
> Always keep changes in the local working directory, verify with tests/typechecks, and await explicit user confirmation.

---

### Issue #05 — Turbopack Build Error: Multiple Definitions of `actions`

#### Problem & Error Output
```
./components/document/document-view.tsx:243:9
the name `actions` is defined multiple times
  241 |   const actions = availableActionsData?.actions || [];
  242 |   // Filter out actions where caller lacks the required role entirely
> 243 |   const actions = (availableActionsData?.actions || []).filter((action) => {
```

#### Root Cause
During the edit to add role filtering, an earlier declaration `const actions = availableActionsData?.actions || [];` remained unremoved at line 241.

#### Fix Applied
Removed the redundant un-filtered declaration and kept only the filtered `actions` constant.

---

### Issue #06 — Convex Runtime Crash on GRN Detail Page

#### Problem & Error Output
```
[CONVEX Q(lifecycle:availableActions)] Server Error
Uncaught Error: Lifecycle machine not found for table "grn".
  at DocumentView (components/document/document-view.tsx:177:40)
  at GrnDetailPage (app/(dashboard)/dashboard/grn/[id]/page.tsx:51:7)
```

#### Root Cause
1. NOTION's lifecycle state machines are defined for 5 core procurement documents: `material_request`, `cost_comparison`, `purchase_order`, `delivery_challan`, and `rfq`.
2. Non-lifecycle documents like `grn` (Goods Receipt Note) and `inventory` share the generic `DocumentView` layout.
3. `DocumentView` called `useQuery(api.lifecycle.availableActions, ...)` for *all* document types.
4. When `table = "grn"` was passed, `computeAvailableActions` in `convex/lifecycle/actions.ts` executed:
   ```ts
   const machine = LIFECYCLE_REGISTRY[table as LifecycleTable];
   if (!machine) {
     throw new Error(`Lifecycle machine not found for table "${table}".`);
   }
   ```
   This unhandled exception caused the Convex query to fail and crashed the GRN detail page.

#### Fix Applied
1. **Frontend Skip Guard (`components/document/document-view.tsx`)**:
   ```tsx
   const isLifecycleDoc = [
     "material_request",
     "cost_comparison",
     "purchase_order",
     "delivery_challan",
     "rfq",
   ].includes(docType);

   const availableActionsData = useQuery(
     api.lifecycle.availableActions,
     doc._id && isLifecycleDoc
       ? { table: docType, documentId: doc._id, token: token || undefined }
       : "skip"
   );
   ```
   Non-lifecycle documents now skip the query entirely, saving bandwidth and network calls.
2. **Backend Graceful Fallback (`convex/lifecycle/actions.ts`)**:
   ```ts
   const machine = LIFECYCLE_REGISTRY[table as LifecycleTable];
   if (!machine) {
     return { status: doc.status || "completed", actions: [] };
   }
   ```
   If any non-lifecycle document type is queried, `computeAvailableActions` returns an empty actions list instead of crashing.
3. **Regression Test (`tests/available_actions_matrix.test.ts`)**:
   Added a test asserting that non-lifecycle tables (e.g., `grn`) return an empty action list without throwing across all system roles.

---

### Issue #07 — Parse Error: `Expected ',', got 'ident'` in `document-view.tsx`

#### Problem & Error Output
```
./components/document/document-view.tsx:188:5
Expected ',', got 'ident'
  186 |     api.lifecycle.availableActions,
  187 |     doc._id
> 188 |     doc._id && isLifecycleDoc
```

#### Root Cause
A replace tool execution left the previous line `doc._id` on line 187 directly above `doc._id && isLifecycleDoc` on line 188 inside the argument list of `useQuery`.

#### Fix Applied
Cleaned lines 185–191 in `components/document/document-view.tsx` to remove the stray identifier. The call is now properly formatted:
```tsx
const availableActionsData = useQuery(
  api.lifecycle.availableActions,
  doc._id && isLifecycleDoc
    ? { table: docType, documentId: doc._id, token: token || undefined }
    : "skip"
);
```

---

## 🧪 Verification & Gate Compliance

All changes were rigorously verified across all gates:

1. **Automated Vitest Test Suite**:
   ```bash
   npm test
   ```
   **Result**: `21 passed (21 test files), 711 passed (711 tests)` in 6.07s.

2. **TypeScript Static Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   **Result**: 0 errors, exit code 0.

3. **Gate 3 Architecture & Invariants Check**:
   ```bash
   npm run check:gate3
   ```
   **Result**: 100% Green.
   - All 5 contracts verified
   - 0 hardcoded Tailwind palette colors
   - 0 relative `"../"` imports
   - 0 `"status as any"` casts

---

## 📁 Files Modified Today

| File | Changes Made |
|---|---|
| `convex/material_requests.ts` | Added `updateMR` mutation with role checks, item validation, and audit logging |
| `app/(dashboard)/dashboard/supervisor/material-requests/[id]/edit/page.tsx` | Added "Save Draft" & "Save Changes" buttons; separated draft saving from lifecycle submissions |
| `components/document/document-view.tsx` | Added `isLifecycleDoc` query guard, filtered role-ineligible action buttons, fixed light theme contrast, resolved syntax & duplicate identifier errors |
| `convex/lifecycle/actions.ts` | Graceful fallback for non-lifecycle tables in `computeAvailableActions` (returns `{ status, actions: [] }` instead of throwing) |
| `tests/available_actions_matrix.test.ts` | Added regression test for non-lifecycle tables |
| `tests/mutation_wiring.test.ts` | Added `updateMR` wiring assertion |
| `tests/ui_action_parity.test.ts` | Added test asserting `DocumentView` role-based filtering |
| `AGENTS.md` | Added strict rule against automatic git commit / git push |
| `CLAUDE.md` | Added strict rule against automatic git commit / git push |
| `_docs/agent-rules.md` | Added strict rule against automatic git commit / git push |
| `Build guide/_docs/agent-rules.md` | Added strict rule against automatic git commit / git push |
| `Build guide/_Obsidian Brain/agent-rules.md` | Added strict rule against automatic git commit / git push |
| `Build guide/zClaude Project Files/antigravity-standing-rules.md` | Added strict rule against automatic git commit / git push |
