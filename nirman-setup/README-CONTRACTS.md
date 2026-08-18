# Nirman — Contracts & Codegen Bundle

Drop-in for Phase 1. Copy `contracts/`, `scripts/` and the two npm scripts into your repo
root, then:

```bash
node scripts/generate-from-contracts.mjs          # writes convex/schema.ts + lib/schemas/*.ts
node scripts/generate-from-contracts.mjs --check  # CI: non-zero exit if generated files are stale
```

## What's here

| Path | Status | Notes |
|---|---|---|
| `contracts/*.json` | **source of truth — edit these** | 13 contracts |
| `scripts/generate-from-contracts.mjs` | source of truth | the generator |
| `convex/schema.ts` | **GENERATED — never hand-edit** | 13 tables, 44 indexes |
| `lib/schemas/*.ts` | **GENERATED — never hand-edit** | one Zod schema per contract |
| `lib/contract-types.ts` | **GENERATED** | `Role`, `ContractTable`, `AnyStatus` unions |

## The workflow, forever

1. Edit `contracts/<name>.json`
2. `npm run gen`
3. Convex picks up the new schema on save; the form picks up the new Zod schema

Never the other way round. Add `npm run gen:check` to CI so a hand-edit can't survive a PR.

## Design decisions baked into the generator

- **`date` → `v.string()`** storing ISO-8601 (`2026-08-24`). ISO strings sort correctly in
  Convex indexes, so date-ordered queries work without a separate numeric column.
- **`file` → `v.id("_storage")`** (Convex file storage). Swapping to Cloudflare R2 via
  `@convex-dev/r2` later changes only this one mapping.
- **Read-only fields are in the DB schema but not in the Zod form schema.** Anything with
  `input: readonly | readonly-badge | hidden` — `refNo`, `subtotal`, `taxAmount`, `total`,
  `amount`, `status`, `reviewedAt` — is computed or set server-side. The form literally
  cannot submit them. Enforced recursively, including inside array line items.
- **`type: enum` → literal union in Convex.** `type: string` carrying a `validation.enum`
  stays `v.string()` in Convex but becomes `z.enum([...])` in Zod. Deliberate: controlled
  vocabularies like `unit` are enforced at the form boundary without making every new unit
  a database migration.
- **Audit columns are appended automatically** from each contract's `audit` block:
  `createdBy`, `updatedBy`, `updatedAt`. `logs` opts out (`audit.enabled: false`) since it
  *is* the audit trail.

## Validation the generator runs before emitting anything

Exits non-zero on: invalid JSON · missing `field`/`label`/`type` · non-explicit `required` ·
duplicate field names · a `relation.table` that isn't a contract · `type: enum` without
`validation.enum` · an index column that isn't a field. Warns on selects with no option source.

Current state: **0 errors, 0 warnings**, and `npx tsc --noEmit` is clean on the emitted output.

## Known gaps (deliberate, for Sprint 2)

- `rfq` and `inventory` contracts are complete but their UI is out of Sprint 1 scope.
  Defining them now means adding those features later is not a schema migration.
- `purchase_order.deliveredQty` / `pendingQty` exist for partial delivery; nothing writes
  them in Sprint 1.
- `conditional` field visibility is in the contract format but the generator ignores it —
  handle it in the Universal Document Form, not in the schema.
