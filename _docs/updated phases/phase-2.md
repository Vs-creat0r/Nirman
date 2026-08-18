# Phase 2 — Convex Backend Derived from JSON

> **Goal:** Turn the JSON contracts from Phase 1 into a clean, production-grade Convex backend — schema, validators, indexes, relations, and every query/mutation the frontend will need. Everything in this phase is **derived from the contracts**, so the schema stays consistent by construction.
>
> **Read first:** `phase-1.md` (the contracts you created), `_docs/tech-stack.md` (Convex section), `_docs/project-rules.md`, `_docs/user-flow.md` (role logic).
>
> **Prerequisites:** Phase 1 complete — `contracts/` exists and Convex is connected.

---

## Deliverables

At the end of this phase:

- `convex/schema.ts` fully defines every table from the contracts, with validators, indexes, and relations.
- A `convex/` functions module per domain (users, projects, vendors, requests, rfqs, cost comparisons, purchase orders, delivery challans, grns, inventory, logs).
- Every mutation/query is **role-guarded** (per `project-rules.md` role logic).
- Auth is wired: login/logout/me working end-to-end against Convex.
- Audit logging enabled on state-changing actions.
- The backend is testable from the Convex dashboard and Postman.

---

## The Golden Rule of This Phase

> **Every table and function maps to a contract.** If it's not in a JSON contract, it doesn't go in the schema. If a field isn't in the contract, it doesn't go in a function's input or output. The contract is the law.
>
> When you need a new field later: edit the contract first → regenerate → then touch Convex. Never add a field straight to the schema.

---

## Task 1 — Map contracts to Convex types

Before writing code, make a mapping table (in a `docs/` file or your notes) so nothing is improvised:

| Contract type | Convex validator |
|---------------|------------------|
| `string` | `v.string()` |
| `number` | `v.number()` |
| `boolean` | `v.boolean()` |
| `array` | `v.array(v.object({...}))` |
| `object` | `v.object({...})` |
| `date` | `v.number()` (Unix ms) |
| `reference` | `v.id("<table>")` |
| `enum` | `v.union(v.literal("a"), v.literal("b"), ...)` |
| `text` (long) | `v.string()` |

Status enums from the contract's `statuses` array become `v.union(v.literal(...))` unions.

**Example mapping — `material_request.json`:**
- `site` → `v.id("sites")`
- `project` → `v.id("projects")`
- `items` → `v.array(v.object({ itemName: v.string(), quantity: v.number(), unit: v.string() }))`
- `priority` → `v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))`
- `status` → union of the contract's `statuses`

---

## Task 2 — Write `convex/schema.ts`

Define **every table** from the contracts in one schema file. Each contract's `indexes` become `.index()` calls; each `relation` becomes `v.id("<table>")`.

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("project_manager"),
      v.literal("procurement_officer"),
      v.literal("site_supervisor")
    ),
    passwordHash: v.optional(v.string()),  // hashed, never stored plaintext
    phone: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  projects: defineTable({
    name: v.string(),
    sites: v.array(v.id("sites")),
    tenderPdfUrl: v.optional(v.string()),
    status: v.string(),
    createdBy: v.id("users"),
  })
    .index("by_name", ["name"])
    .index("by_createdBy", ["createdBy"]),

  sites: defineTable({
    name: v.string(),
    address: v.string(),
    projectId: v.id("projects"),
  })
    .index("by_project", ["projectId"]),

  vendors: defineTable({
    name: v.string(),
    contact: v.string(),
    gstNo: v.string(),
    address: v.string(),
    category: v.string(),
    isActive: v.boolean(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"]),

  materialRequests: defineTable({
    site: v.id("sites"),
    project: v.id("projects"),
    items: v.array(v.object({
      itemName: v.string(),
      quantity: v.number(),
      unit: v.string(),
    })),
    notes: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("queried"),
      v.literal("out_for_delivery"),
      v.literal("delivered")
    ),
    createdBy: v.id("users"),
    updatedAt: v.optional(v.number()),
  })
    .index("by_site", ["site"])
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"])
    .index("by_createdAt", ["_creationTime"]),

  // ...rfqs, costComparisons, purchaseOrders, deliveryChallans, grns,
  //     inventory, logs — one table per contract, same pattern.
});
```

### Table naming rule
Contract `name` is snake_case (`material_request`); Convex table is **camelCase** (`materialRequests`). Keep a single mapping table in `docs/` so Phase 3 and 4 can look it up.

### Verification — Task 2
- [ ] One `defineTable` per contract (13 tables). Count them.
- [ ] Every relational field uses `v.id("<table>")` where `<table>` exists.
- [ ] Every `status` field uses a union matching the contract's `statuses`.
- [ ] `npx convex dev` runs without schema errors (Convex validates on push).

---

## Task 3 — Convex helpers & shared validators

Create `convex/lib/` with shared helpers so functions stay DRY:

1. **`convex/lib/validation.ts`** — a Zod schema (frontend) is Phase 3; here create the Convex `v` objects per contract, exported once:

   ```ts
   // convex/lib/contracts.ts
   import { v } from "convex/values";
   export const materialRequestInput = v.object({
     site: v.id("sites"),
     project: v.id("projects"),
     items: v.array(v.object({ itemName: v.string(), quantity: v.number(), unit: v.string() })),
     notes: v.optional(v.string()),
     priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))),
   });
   ```

   > Centralizing validators means the contract stays the single source — when you edit a contract, you edit it once here.

2. **`convex/lib/auth.ts`** — role helpers used by every function:

   ```ts
   import { query, mutation } from "../_generated/server";
   import { v } from "convex/values";

   export async function requireRole(ctx, allowed: string[]) {
     const identity = await ctx.auth.getUserIdentity();
     if (!identity) throw new Error("Unauthenticated");
     const user = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", identity.email)).first();
     if (!user || !user.isActive) throw new Error("User not found or inactive");
     if (!allowed.includes(user.role)) throw new Error("Forbidden: insufficient role");
     return user;
   }
   ```

   > **Convex security note:** `ctx.auth.getUserIdentity()` is the ONLY way to know who's calling. Every mutation that creates/updates/deletes data must call `requireRole` first. Queries that expose sensitive data must too.

### Verification — Task 3
- [ ] `convex/lib/contracts.ts` exports one input validator per contract.
- [ ] `convex/lib/auth.ts` exports `requireRole`.
- [ ] No function can run without passing through role logic (enforce in Task 4).

---

## Task 4 — Convex functions per domain

Create one file per domain under `convex/`. Each file has a small set of **mutations** (create/update/delete/transition) and **queries** (list/get).

### 4.1 Domain files

| File | Mutations | Queries |
|------|-----------|---------|
| `convex/users.ts` | `createUser`, `updateUser`, `deactivateUser` | `getMe`, `listUsers` (admin) |
| `convex/projects.ts` | `createProject`, `updateProject` | `listProjects`, `getProject` |
| `convex/vendors.ts` | `createVendor`, `updateVendor` | `listVendors`, `getVendor` |
| `convex/requests.ts` | `createRequest`, `submitRequest`, `approveRequest`, `rejectRequest`, `queryRequest`, `resubmitRequest`, `markDelivered` | `listMyRequests`, `listRequestsByStatus`, `getRequest` |
| `convex/rfqs.ts` | `createRFQ`, `updateRFQ`, `sendRFQ` | `listRFQs`, `getRFQ` |
| `convex/costComparisons.ts` | `createCostComparison`, `selectVendor`, `approveCostComparison` | `listCostComparisons`, `getByRFQ` |
| `convex/purchaseOrders.ts` | `createPO`, `updatePO` | `listPOs`, `getPO` |
| `convex/deliveryChallans.ts` | `createDC`, `updateDC` | `listDCs`, `getByPO` |
| `convex/grns.ts` | `createGRN` (auto on delivered) | `listGRNs`, `getByPO` |
| `convex/inventory.ts` | `adjustStock`, `setThreshold` | `listInventory`, `lowStock` |
| `convex/logs.ts` | `writeLog` (internal) | `listLogs` (admin) |

### 4.2 The approval flow — follow `user-flow.md` & `project-rules.md` exactly

The role logic is **non-negotiable**:

- **Project Manager creates → immediately finalized** (no approval step).
- **Procurement Officer creates → goes to Project Manager for approval** (approve / query / reject).
- **Site Supervisor creates material requests only** — cannot create procurement documents.

Example mutation (`convex/requests.ts`) — note the role guard:

```ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { materialRequestInput } from "./lib/contracts";
import { requireRole } from "./lib/auth";

export const createRequest = mutation({
  args: { input: materialRequestInput },
  handler: async (ctx, { input }) => {
    const user = await requireRole(ctx, ["site_supervisor", "project_manager", "admin"]);
    const id = await ctx.db.insert("materialRequests", {
      ...input,
      status: "draft",
      createdBy: user._id,
    });
    await ctx.db.insert("logs", {
      actorId: user._id, action: "create", documentType: "material_request",
      documentId: id, timestamp: Date.now(),
    });
    return id;
  },
});

export const approveRequest = mutation({
  args: { id: v.id("materialRequests"), notes: v.optional(v.string()) },
  handler: async (ctx, { id, notes }) => {
    const user = await requireRole(ctx, ["project_manager", "admin"]);
    await ctx.db.patch(id, { status: "approved", updatedAt: Date.now() });
    // log the transition for audit
    await ctx.db.insert("logs", {
      actorId: user._id, action: "approve", documentType: "material_request",
      documentId: id, timestamp: Date.now(),
    });
    return id;
  },
});
```

### 4.3 Audit logging

Every state-changing mutation writes a `logs` row: `actorId`, `action`, `documentType`, `documentId`, `timestamp` (matches the `logs.json` contract). Keep it inside the same mutation (transactionally safe).

### Verification — Task 4
- [ ] Every mutation starts with a `requireRole(...)` call.
- [ ] Every state change writes an audit log row.
- [ ] Status transitions match the contract's `statuses` array (no invalid transition possible).
- [ ] Test from the dashboard: create a request as site supervisor, approve as manager — confirm the log appears.

---

## Task 5 — Authentication wiring (login/logout/me)

Now connect the Phase 1 auth scaffold to Convex.

1. **Login mutation** (`convex/auth.ts`):

   ```ts
   import { mutation, query } from "../_generated/server";
   import { v } from "convex/values";
   import bcrypt from "bcryptjs";

   export const login = mutation({
     args: { email: v.string(), password: v.string() },
     handler: async (ctx, { email, password }) => {
       const user = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", email.toLowerCase())).first();
       if (!user || !user.passwordHash) throw new Error("Invalid credentials");
       const ok = await bcrypt.compare(password, user.passwordHash);
       if (!ok) throw new Error("Invalid credentials");
       // Issue your JWT (from lib/auth.ts) and return it; store in HTTP-only cookie (Phase 3/4).
       return { token: signToken({ sub: user._id, role: user.role }), user: { _id: user._id, name: user.name, role: user.role } };
     },
   });

   export const me = query({
     args: {},
     handler: async (ctx) => {
       const identity = await ctx.auth.getUserIdentity();
       if (!identity) return null;
       const user = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", identity.email)).first();
       return user ?? null;
     },
   });
   ```

2. **Seed an admin user** so you can log in: create `convex/seed.ts` or a one-off mutation that inserts an admin with a hashed password. Run it once from the dashboard.

   ```ts
   const hash = await bcrypt.hash("ChangeMe123!", 12);
   // insert user with role "admin", isActive true
   ```

3. Confirm the full loop in the dashboard: call `login` → get token → call `me` with identity → see the user.

> **Security note:** Only the **hash** is ever stored. Never return `passwordHash` from any query. Rate-limit the `login` mutation in Phase 5 (or now — Convex `rateLimiter` is trivial to add).

### Verification — Task 5
- [ ] `login` returns a token + user for a valid admin.
- [ ] `login` throws for wrong credentials (and doesn't leak which field was wrong).
- [ ] `me` returns `null` when unauthenticated, the user when authenticated.
- [ ] `passwordHash` never appears in any query result.

---

## Task 6 — Security hardening

- [ ] **Role guards on every mutation** (done in Task 4) — re-scan the whole `convex/` folder.
- [ ] **Query-level guarding** — queries returning lists/documents check the caller can see them (site supervisor sees own requests only).
- [ ] **No password/secret leaks** — grep for `console.log` in `convex/`.
- [ ] **Input validation** — every mutation uses the contract validator (no `v.any()`).
- [ ] **Rate limiting** (recommend adding now): create a Convex `rateLimiter` for `login` and any public endpoint:

  ```ts
  // convex/rateLimiter.ts (Convex docs pattern)
  export const rateLimiter = new RateLimiter({
    login: { kind: "fixed window", rate: 10, period: 60 },
  });
  ```

- [ ] **Reference integrity** — mutations verify referenced IDs exist (e.g. creating an RFQ for a missing vendor fails).

---

## Phase 2 — Final Verification

- [ ] All 13 tables in `convex/schema.ts`, derived from contracts (Task 2 checklist).
- [ ] Shared validators + role helper in `convex/lib/` (Task 3).
- [ ] Domain functions per the table in Task 4, all role-guarded, all audited.
- [ ] Auth loop works: login → me → logout (Task 5).
- [ ] Security checklist (Task 6) green.
- [ ] `npm run lint` / `npx convex deploy --dry-run` passes if you have one configured.

**Backend is done.** Move to [phase-3.md](phase-3.md) — build the themed frontend that reads these same contracts.
