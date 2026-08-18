# Phase 1 — JSON Contracts + Project Foundation

> **Goal:** Define the entire data model as JSON contracts (the single source of truth), and stand up a bootable, secure Next.js + Convex + Git project that future phases build on.
>
> **Read first:** `_docs/project-overview.md`, `_docs/tech-stack.md`, `_docs/project-rules.md`, `README.md` (in this folder).
>
> **Prerequisites:** The tools listed in `README.md` → "Prerequisites". You have a GitHub account.

---

## Deliverables

At the end of this phase:

- A `contracts/` folder at project root with **one JSON file per document/page** — fully filled out (fields, types, relations, statuses, validation).
- A Next.js + TypeScript + Tailwind v4 project that boots at `http://localhost:3000`.
- Convex initialized and connected (running `npx convex dev` works).
- Git repository initialized, `.gitignore` correct, first commit made.
- `.env.local` created with secrets **never** committed to Git.
- A `docs/contract-format.md` (or section) explaining how to read and extend a contract.

---

## How This Phase Maps to the Big Picture

```
Phase 1 (you are here)      Phase 2                Phase 3               Phase 4
JSON contracts   ───────►   Convex schema   ───►   UI forms +      ───►  Live wiring
(single truth)             + functions            theming, on           (real data flows)
                                                    mock data
```

Phase 1 produces the **contracts** that Phases 2, 3, and 4 all read. Do this phase properly and every later phase becomes mechanical.

---

## Task 1 — Create the project folder & initialize Git

1. Create the project root folder (e.g. `nirman/`) and open it in VS Code.
2. Open a terminal there.
3. Initialize Git:

   ```bash
   git init
   git branch -M main
   ```

4. Create a `.gitignore` (Next.js standard) — at minimum:

   ```gitignore
   node_modules/
   .next/
   out/
   .env*.local
   .env
   .DS_Store
   *.log
   convex/_generated/
   ```

   > **Security note:** `.env*.local` and `.env` are in `.gitignore` because they hold secrets (Convex URLs, auth keys, R2 tokens). If a secret ever gets committed, rotate it immediately — do not try to "uncommit" it.

5. Create an initial `README.md` at root (1–2 lines about the project).

---

## Task 2 — Create the JSON Contracts (the core of this phase)

Create a folder `contracts/` at the project root. This is the **single source of truth** for the data model.

### 2.1 The contract format (read this before writing any JSON)

Every contract file uses this structure:

```json
{
  "$schema": "contract.v1",
  "name": "snake_case_name",
  "label": "Human Readable Name",
  "version": "1.0.0",
  "description": "What this document/entity is.",
  "fields": [ ... ],
  "statuses": [ ... ],
  "relations": { ... },
  "indexes": [ ... ],
  "audit": { ... }
}
```

### 2.2 Field object — every option

```json
{
  "field": "vendor_id",
  "label": "Vendor",
  "type": "string | number | boolean | array | object | date | reference | enum | text",
  "required": true,
  "default": null,
  "input": "text | number | select | multi-select | date | autocomplete | item-list | textarea | readonly-badge | file",
  "optionsFrom": "vendors",
  "relation": { "table": "vendors" },
  "validation": {
    "min": 0,
    "max": 100,
    "pattern": "^[A-Z0-9]*$",
    "minLength": 1,
    "maxLength": 255,
    "enum": ["draft", "approved"]
  },
  "placeholder": "Select vendor...",
  "help": "Shown under the field",
  "conditional": { "field": "type", "equals": "PO" }
}
```

| Option | Purpose |
|--------|---------|
| `field` | Backend/DB key (snake_case). **Never changes** once in production. |
| `label` | What the user sees on the form. Change freely. |
| `type` | Data type → maps directly to a Convex validator (`v.string()`, `v.number()`, `v.array()`, `v.id()`…). |
| `input` | The UI control to render (text, select, autocomplete, item-list…). |
| `optionsFrom` | Pull select/autocomplete options from another contract (e.g. vendors). |
| `relation` | Foreign key to another table → becomes `v.id("vendors")` in Convex. |
| `validation` | Rules → becomes Zod schema in the form + Convex validators on the server. |
| `conditional` | Show this field only when another field equals a value. |

> **Rule:** a field's `type` and `relation` are **structural** — they shape the database. `label`, `input`, `placeholder`, `help` are **presentational** — the UI reads them. Changing presentational fields is always safe; changing structural fields requires a migration. Keep that discipline and updates stay simple forever.

### 2.3 The contract files you must create

Create **all** of the following in `contracts/`. Use your `_docs/` files (`project-overview.md`, `user-flow.md`, `smart-inputs-rules.md`, `phase-2-mvp.md`) as the field source — they already describe what each document contains.

| File | Derived from | Minimum fields to include |
|------|-------------|--------------------------|
| `users.json` | project-overview (roles) | name, email, role, isActive, phone |
| `projects.json` | project-overview | name, sites[], tenderPdfUrl, status |
| `project_items.json` | phase-2-mvp | projectId, name, unit, qty, description |
| `sites.json` | project-overview | name, address, projectId |
| `vendors.json` | phase-2-mvp | name, contact, gstNo, address, category, isActive |
| `material_request.json` | user-flow §2.2 | project, site, items[], notes, priority, status |
| `rfq.json` | phase-2-mvp | linkedRequestIds[], projectItemIds[], vendorIds[], status, notes |
| `cost_comparison.json` | phase-2-mvp | rfqId, vendorQuotes[], selectedVendorId, status, approvedBy, notes |
| `purchase_order.json` | phase-2-mvp | ccId, vendorId, lineItems[], paymentTerms, status, pdfUrl, deliveredQty, pendingQty |
| `delivery_challan.json` | phase-2-mvp | poId, vehicleNo, driverName, dispatchedItems[], isPartial, expectedArrival, status |
| `grn.json` | phase-2-mvp | poId, receivedItems[], photos[], invoiceNumber, confirmedBy, confirmedAt |
| `inventory.json` | phase-3 (inventory) | materialCategory, quantity, unit, warehouseLocation, lastUpdated |
| `logs.json` | phase-2-mvp | actorId, action, documentType, documentId, referenceId, timestamp |

### 2.4 Example — `contracts/material_request.json`

```json
{
  "$schema": "contract.v1",
  "name": "material_request",
  "label": "Material Request",
  "version": "1.0.0",
  "description": "A request raised by a Site Supervisor for materials at a site.",
  "fields": [
    { "field": "site", "label": "Site", "type": "reference", "input": "select", "relation": { "table": "sites" }, "required": true },
    { "field": "project", "label": "Project", "type": "reference", "input": "select", "relation": { "table": "projects" }, "required": true },
    { "field": "items", "label": "Items", "type": "array", "input": "item-list", "required": true,
      "items": { "type": "object", "fields": [
        { "field": "itemName", "label": "Item", "type": "string", "input": "autocomplete", "optionsFrom": "inventory", "required": true },
        { "field": "quantity", "label": "Qty", "type": "number", "input": "number", "required": true, "validation": { "min": 1 } },
        { "field": "unit", "label": "Unit", "type": "string", "input": "text", "required": true }
      ]}
    },
    { "field": "notes", "label": "Notes", "type": "text", "input": "textarea", "required": false },
    { "field": "priority", "label": "Priority", "type": "enum", "input": "select", "required": true,
      "validation": { "enum": ["low", "normal", "high", "urgent"] }, "default": "normal" },
    { "field": "status", "label": "Status", "type": "enum", "input": "readonly-badge", "required": true, "default": "draft" }
  ],
  "statuses": ["draft", "pending", "approved", "rejected", "queried", "out_for_delivery", "delivered"],
  "relations": { "site": "sites", "project": "projects" },
  "indexes": [ ["site"], ["status"], ["createdAt"] ],
  "audit": { "enabled": true, "trackCreatedBy": true, "trackUpdatedAt": true }
}
```

### 2.5 Verification — Task 2

- [ ] `contracts/` contains all 13 files listed in §2.3.
- [ ] Every field has `field`, `label`, `type`; `required` is explicit (true/false).
- [ ] Every select/autocomplete has either `optionsFrom` or a `validation.enum`.
- [ ] Every relational field has a `relation.table` that points to another existing contract.
- [ ] Each contract has a `statuses` array that matches the status flow in `user-flow.md`.

---

## Task 3 — Initialize the Next.js app

1. From the project root:

   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false
   ```

   > If the folder isn't empty (Git files are fine), use `--force` or answer the prompts to proceed. Answer **Yes** to TypeScript, Tailwind, ESLint, App Router.

2. Confirm it runs:

   ```bash
   npm run dev
   ```

   → Open `http://localhost:3000` and confirm the default page loads.

3. Install the UI/theme stack (per `tech-stack.md`):

   ```bash
   npm install next-themes @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-label @radix-ui/react-slot lucide-react react-hook-form @hookform/resolvers zod
   ```

4. Create the path alias in `tsconfig.json` (Next.js 15 usually has it already):

   ```json
   { "compilerOptions": { "paths": { "@/*": ["./*"] } } }
   ```

### Verification — Task 3

- [ ] `npm run dev` serves a page at localhost:3000.
- [ ] `npm install` completes without errors.
- [ ] `@/` alias resolves (create a quick `import { x } from "@/lib/theme"` test later — or trust the tsconfig).

---

## Task 4 — Initialize Convex (full step-by-step)

> If you want the 30-second version, use the **Convex Quick Login** in the README. This is the complete walkthrough.

1. **Install the client + CLI:**

   ```bash
   npm install convex
   ```

2. **Start the dev server (this also logs you in):**

   ```bash
   npx convex dev
   ```

   - A browser tab opens → sign in with **GitHub** (or email) → grant access.
   - If no browser opens, run `npx convex login` and paste the token manually.
   - The CLI will ask you to **create a project** — name it e.g. `nirman` and pick a region (any region is fine).
   - It then asks for the **deployment URL** — accept the default `dev` deployment.

3. **What Convex generated for you** (verify these exist):
   - `convex/schema.ts` — where you define the schema (Phase 2 uses it).
   - `convex/_generated/` — auto-generated typed helpers (never hand-edit).
   - `convex/tsconfig.json` — Convex's own TS config.
   - `.env.local` — now contains `NEXT_PUBLIC_CONVEX_URL=...`. **This is a dev URL, safe to commit — but keep the pattern of never committing prod secrets.**

4. **Confirm connection** — the CLI reports "Connected to Convex!" and files appear.

5. **Create a minimal schema** so Convex has something to validate (you'll flesh this out in Phase 2):

   ```ts
   // convex/schema.ts
   import { defineSchema, defineTable } from "convex/server";
   import { v } from "convex/values";

   export default defineSchema({
     users: defineTable({
       name: v.string(),
       email: v.string(),
       role: v.union(v.literal("admin"), v.literal("project_manager"), v.literal("procurement_officer"), v.literal("site_supervisor")),
       isActive: v.boolean(),
     }).index("by_email", ["email"]),
   });
   ```

   Save it — Convex auto-pushes schema changes on save (watch the terminal).

6. **Open the dashboard:**

   ```bash
   npx convex dashboard
   ```

   → You should see the `users` table in the Data section.

### Convex security notes (important from day 1)

- Convex functions are **public by default** — the browser can call any query/mutation unless you protect it. In Phase 2 every mutation/query will check the authenticated identity + role before doing anything.
- The dev deployment URL (`NEXT_PUBLIC_CONVEX_URL`) is *not* a secret — but treat the **prod** deployment URL and any auth secrets as secrets.
- Use Convex **rate limiting** (Phase 2/5) on public endpoints to prevent abuse.
- Never log `ctx.auth.getUserIdentity()` payloads, tokens, or emails to the console.

### Verification — Task 4

- [ ] `npx convex dev` runs without errors and shows "Connected".
- [ ] `convex/schema.ts` exists and the `users` table appears in the dashboard.
- [ ] `.env.local` contains `NEXT_PUBLIC_CONVEX_URL`.
- [ ] `convex/_generated/` is in `.gitignore`.

---

## Task 5 — Configure Auth (baseline for this phase)

Full auth wiring happens in Phase 2; here you install the pieces and confirm login can be reached.

1. Choose the auth approach per `tech-stack.md` — **JWT (custom) is recommended** for full control; Clerk is the faster managed option. The rest of this phase assumes JWT.

2. Install JWT + hashing libraries:

   ```bash
   npm install jsonwebtoken bcryptjs
   npm install -D @types/jsonwebtoken @types/bcryptjs
   ```

3. Create `lib/auth.ts` with the token helpers (scaffold only — full logic in Phase 2):

   ```ts
   // lib/auth.ts
   import jwt from "jsonwebtoken";

   const SECRET = process.env.JWT_SECRET!;
   const COOKIE = "nirman_session";

   export const signToken = (payload: { sub: string; role: string }) =>
     jwt.sign(payload, SECRET, { expiresIn: "8h" });

   export const verifyToken = (token: string) =>
     jwt.verify(token, SECRET) as { sub: string; role: string };
   ```

4. Add `JWT_SECRET` to `.env.local`:

   ```
   JWT_SECRET=generate-a-long-random-string-here
   ```

   > Generate it with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

5. Create the login page shell at `app/(auth)/login/page.tsx` — just a form with email + password (no logic yet; Phase 2 implements the handler). Reference `user-flow.md` §1 for the auth flow and redirect rules.

### Verification — Task 5

- [ ] `lib/auth.ts` compiles (imports resolve).
- [ ] `JWT_SECRET` is in `.env.local` and **not** in any committed file.
- [ ] `app/(auth)/login/page.tsx` renders a form at `/login`.

---

## Task 6 — Security baseline (run this checklist before finishing the phase)

- [ ] `.gitignore` excludes `node_modules`, `.next`, `.env*`, and any `*.local` files.
- [ ] No secrets (JWT_SECRET, R2 keys, prod URLs) appear in any committed file.
- [ ] `git status` shows only intended files — **verify no `.env` is tracked**.
- [ ] `npm audit` reports no high/critical vulnerabilities:

  ```bash
  npm audit --audit-level=high
  ```

- [ ] You understand that Convex functions are public-by-default and will be role-guarded in Phase 2.
- [ ] `lib/auth.ts` does not log tokens or passwords anywhere.

---

## Task 7 — First commit

```bash
git add .
git commit -m "Phase 1: contracts + Next.js/Convex foundation"
```

Create a remote (GitHub) if you want a backup:

```bash
gh repo create nirman --private --source=. --push
```

---

## Phase 1 — Final Verification

- [ ] All 13 contract files exist and are internally consistent (Task 2 checklist).
- [ ] `npm run dev` boots the app.
- [ ] `npx convex dev` connects; `users` table visible in dashboard.
- [ ] Login page renders at `/login`.
- [ ] Security baseline checklist (Task 6) all green.
- [ ] Git has one clean commit.

**You are done with Phase 1.** Move to [phase-2.md](phase-2.md) — it turns these contracts into a production Convex backend.
