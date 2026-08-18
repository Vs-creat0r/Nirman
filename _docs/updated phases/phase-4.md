# Phase 4 — Integration & Dynamic Wiring

> **Goal:** Replace the mock data from Phase 3 with live Convex data. The entire procurement flow — request → approval → RFQ → cost comparison → PO → DC → GRN — works end-to-end in real time, with proper loading/error/success states and auth-aware routing.
>
> **Read first:** `phase-3.md` (component library you built), `phase-2.md` (the Convex functions), `_docs/user-flow.md`, `_docs/project-rules.md`.
>
> **Prerequisites:** Phase 1–3 complete. Convex backend functions exist and are role-guarded; UI components exist on mock data.

---

## Deliverables

At the end of this phase:

- Mock data replaced by live Convex `useQuery` / `useMutation` calls — **no hardcoded data** remains in the app.
- Convex client wired via a provider + environment-typed hooks.
- Auth-aware routing enforced: `/dashboard/*` requires a valid session; roles redirected per `user-flow.md` §1.
- Loading, error, and empty states implemented across every list/form.
- The full procurement journey is demonstrable end-to-end with real data.
- JWT login persists via HTTP-only cookie; refresh/logout handled.
- Validation is enforced on both client (Zod) and server (Convex validators) with consistent error messages.

---

## Task 1 — Convex client provider

1. Install the Convex React bindings (already installed in Phase 1, confirm):

   ```bash
   npm install convex
   ```

2. Create the provider:

   ```tsx
   // components/convex-client-provider.tsx
   "use client";
   import { ConvexProvider, ConvexReactClient } from "convex/react";

   const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

   export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
     return <ConvexProvider client={convex}>{children}</ConvexProvider>;
   }
   ```

3. Wrap the app in `app/layout.tsx` (inside `ThemeProvider`).

4. Create a typed helper so components import generated types instead of loose strings:

   ```ts
   // lib/convex.ts
   export * from "../convex/_generated/api";
   ```

   > The `_generated` folder is auto-created by `npx convex dev` — never hand-edit it.

### Verification — Task 1
- [ ] `app/layout.tsx` wraps children in `ConvexClientProvider`.
- [ ] A quick `useQuery(api.users.me)` in any component returns the current user or `null` (no network errors).

---

## Task 2 — Swap mock data for live queries

Replace each mock import in `app/` and `components/` with a live query. Follow the pattern:

```tsx
// app/(dashboard)/site/page.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";

export default function SiteDashboard() {
  const requests = useQuery(api.requests.listMyRequests);
  const pending = (requests ?? []).filter(r => r.status === "pending").length;

  if (requests === undefined) return <Skeleton rows={4} />;          // loading
  if (requests === null) return <ErrorState message="Could not load requests" />;

  return (
    <>
      <StatCard label="Active Requests" value={pending} />
      {requests.length === 0 && <EmptyState title="No requests yet" action={<NewRequestButton />} />}
      <RequestTable rows={requests} />
    </>
  );
}
```

### Loading / Error / Empty discipline (from `ui-rules.md`)
- `data === undefined` → **Skeleton** (first load).
- `data === null` → **ErrorState** with a retry.
- `data.length === 0` → **EmptyState** that invites action.
- Never show a raw spinner without context; never show an empty table without a call-to-action.

### Verification — Task 2
- [ ] No `lib/mock/*` imports remain in `app/` (grep).
- [ ] Every list page has the loading/error/empty triple.
- [ ] Adding a row in the Convex dashboard updates the page live (Convex reactivity).

---

## Task 3 — Live mutations in the DocumentForm

Connect the Phase 3 `DocumentForm` to mutations:

1. Pass the submit callback from the page:

   ```tsx
   // app/(dashboard)/requests/new/page.tsx
   import { useMutation } from "convex/react";
   import { DocumentForm } from "@/components/document-form";

   export default function NewRequestPage() {
     const createRequest = useMutation(api.requests.createRequest);
     const router = useRouter();

     return (
       <DocumentForm
         contract={materialRequestContract}
         onSubmit={async (values) => {
           await createRequest({ input: values });
           toast({ title: "Request created", description: "Sent to manager for approval" });
           router.push("/dashboard/site");
         }}
       />
     );
   }
   ```

2. Handle mutation errors: catch, map server errors to friendly messages (e.g. "Forbidden: insufficient role" → "You don't have permission").

3. Respect role logic on submit (from `project-rules.md`): a Project Manager creating a PO finalizes it directly; a Procurement Officer creates it in a pending state → manager approves.

### Verification — Task 3
- [ ] Submitting the form creates a real document in Convex (check dashboard).
- [ ] Server validation errors surface as field/inline errors, not console noise.
- [ ] The audit log (`logs` table) records each mutation.

---

## Task 4 — Auth-aware routing & session

1. Create `middleware.ts` protecting `/dashboard/*`:

   ```ts
   // middleware.ts
   import { NextResponse } from "next/server";
   import type { NextRequest } from "next/server";

   export function middleware(req: NextRequest) {
     const token = req.cookies.get("nirman_session");
     if (!token) {
       return NextResponse.redirect(new URL("/login", req.url));
     }
     return NextResponse.next();
   }

   export const config = { matcher: ["/dashboard/:path*"] };
   ```

   > In App Router the cookie is HTTP-only and set server-side (login API route or server action). The middleware checks presence; the *identity* is verified by Convex's `me` on each protected page load.

2. Implement the login flow (server action or API route):
   - Read email + password → call `api.auth.login` mutation.
   - Set HTTP-only cookie (`nirman_session`) with the JWT, `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production, `maxAge` matching the token expiry (8h).
   - Redirect to the role dashboard (map role → route per `user-flow.md` §1).

3. Implement logout: clear the cookie → redirect to `/login`.

4. Add a `useRole()` hook (already scaffolded in Phase 1) that reads `api.users.me` and returns the role; use it for role-aware rendering everywhere.

### Security notes
- The token **must** be in an **HTTP-only cookie** (not `localStorage`) — prevents XSS token theft.
- Set `secure` in production; keep `sameSite: "lax"`.
- The middleware only gates route access; **real authorization is the Convex `requireRole` guard** from Phase 2 — never trust the middleware alone.

### Verification — Task 4
- [ ] Visiting `/dashboard/...` logged-out redirects to `/login`.
- [ ] Logging in with each role redirects to the correct dashboard.
- [ ] Logout clears the cookie and returns to `/login`.
- [ ] A Site Supervisor hitting a manager mutation gets "Forbidden" (server-enforced).

---

## Task 5 — End-to-end flow test

Walk the entire pipeline with **real data**, exactly as `user-flow.md` defines:

| Step | Actor | Action | Expected result |
|------|-------|--------|-----------------|
| 1 | Site Supervisor | Create material request | Row in `materialRequests`, status `draft`→`pending` |
| 2 | Project Manager | Approve request | Status `approved`, log written |
| 3 | Procurement Officer | Create RFQ from request items + vendors | `rfqs` row, status `sent` |
| 4 | Procurement Officer | Create Cost Comparison, select vendor | `costComparisons` row, pending approval |
| 5 | Project Manager | Approve cost comparison | `selectedVendorId` locked |
| 6 | Procurement Officer | Create PO | `purchaseOrders` row, status `issued` |
| 7 | Procurement Officer | Create DC, mark dispatched | `deliveryChallans` row, `isPartial` handled |
| 8 | Site Supervisor | Mark delivered | GRN auto-created, photos upload prompt, status `delivered` |
| 9 | — | Audit | `logs` table has a row for every transition |

### Verification — Task 5
- [ ] Each step above completes with no console errors.
- [ ] Status badges + lists update in real time as steps happen (two browser tabs: one actor, one watcher).
- [ ] Rejected/queried branches also work: manager queries a request → site supervisor edits & resubmits.

---

## Task 6 — Real-time polish

- [ ] **Optimistic updates:** approve/status buttons update immediately, roll back on server error (Convex's `optimistic` option or React state).
- [ ] **Presence / live refresh:** because Convex pushes, watcher tabs update automatically — confirm on a second browser.
- [ ] **Toasts on every transition** (success / error / query-with-reason).
- [ ] **Form dirty-state guard:** warn before navigating away with unsaved changes.

---

## Security checklist (Phase 4)

- [ ] Session cookie is HTTP-only, `secure` in prod, `sameSite: lax`.
- [ ] No token in `localStorage`, `sessionStorage`, or URL params.
- [ ] Server-side role guard is the source of truth (not the middleware).
- [ ] No sensitive data (passwordHash, tokens, logs content) returned to the client by any query.
- [ ] Server validation errors are mapped to user-friendly messages — no stack traces exposed.
- [ ] Convex rate limiting active on `login` and public endpoints (from Phase 2 Task 6).

---

## Phase 4 — Final Verification

- [ ] No mock data in `app/` (Task 2).
- [ ] DocumentForm creates/updates real documents (Task 3).
- [ ] Route protection + cookie auth works for all four roles (Task 4).
- [ ] Full 9-step procurement flow passes end-to-end (Task 5).
- [ ] Real-time updates confirmed across sessions; optimistic updates on status changes (Task 6).
- [ ] Security checklist green.

**The app is fully functional now.** Move to [phase-5.md](phase-5.md) — advanced features and automation, built safely on this stable core.
