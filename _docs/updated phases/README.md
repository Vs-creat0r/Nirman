# Updated Phases — Construction Site ERP Platform

> This folder is the **step-by-step build roadmap** for the platform, based on the JSON-first (contract-first) approach discussed in `_docs/phases/Stages-thinking.txt`.
>
> **Read this file first.** It explains the philosophy, how to use the phases, and what you need before starting.

---

## Why This Roadmap Exists

The core rule of this build: **the data contract comes first, everything else derives from it.**

```
JSON Contract (source of truth)
      │
      ├──► Convex schema + validators  (backend)
      ├──► Form fields + validation    (frontend)
      └──► Mock data structure         (testing / UI dev)
```

This prevents the problem you hit in your past ERP project — a cluttered, unreadable database schema that happens when you improvise fields while building screens. When the schema is **derived from a contract instead of improvised**, the mess structurally can't happen.

**When you want to change an RFQ form later:** edit one JSON file → regenerate schema + form → done. No schema surgery, no scattered field definitions.

---

## The Phases (in order — do not skip ahead)

| # | Phase | File | What you get at the end |
|---|-------|------|------------------------|
| 1 | JSON Contracts + Foundation | [phase-1.md](phase-1.md) | One JSON contract per document/page + a bootable Next.js/Convex project with Git, env, and security baseline |
| 2 | Convex Backend from JSON | [phase-2.md](phase-2.md) | A clean, production-grade Convex schema + all queries/mutations, derived directly from the JSON |
| 3 | Frontend, Theming & UI/UX | [phase-3.md](phase-3.md) | The full themed UI shell + component library + Universal Document Form, running on mock data |
| 4 | Integration & Dynamic Wiring | [phase-4.md](phase-4.md) | Mock data replaced by live Convex calls; the whole procurement flow works end-to-end, in real-time |
| 5 | Advanced Features & Automation | [phase-5.md](phase-5.md) | n8n webhooks, chat, notifications, inventory, voice/AI — built safely on the stable core |

---

## How to Use These Phases

1. **Go in order.** Each phase has a "Prerequisites" section listing exactly what must be done first.
2. **Each phase is a checklist, not a novel.** Work top-to-bottom; tick every task off.
3. **Stop at every "Verification" block.** It tells you how to confirm the phase actually works before moving on.
4. **Read the related `_docs/` file each phase references** (`project-overview.md`, `user-flow.md`, `ui-rules.md`, `theme-rules.md`, `project-rules.md`, `tech-stack.md`, `smart-inputs-rules.md`) — those are the source of truth for behavior and rules.
5. **Security is baked into every phase**, not left for the end. Each phase has a `Security Checklist` section.

---

## Prerequisites (before Phase 1)

You need these installed on your machine:

| Tool | Version | Purpose | Check |
|------|---------|---------|-------|
| Node.js | 18+ (recommend 20 LTS) | Run Next.js + Convex | `node -v` |
| npm | 8+ (comes with Node) | Package manager | `npm -v` |
| Git | Latest | Version control | `git --version` |
| A GitHub account | — | Convex login + Git remote | — |
| VS Code (recommended) | Latest | Editing | — |
| A terminal (Git Bash / Windows Terminal) | — | Running commands | — |

If any command above fails, install the tool before starting Phase 1.

---

## The JSON Contract Format (the heart of the system)

Every contract lives in `contracts/<name>.json`. The format is **the same shape for every document** — that uniformity is what makes the whole system simple to update.

Minimal example (Material Request):

```json
{
  "$schema": "contract",
  "name": "material_request",
  "label": "Material Request",
  "version": "1.0.0",
  "fields": [
    {
      "field": "project",
      "label": "Project",
      "type": "string",
      "input": "select",
      "relation": { "table": "projects" },
      "required": true
    },
    {
      "field": "items",
      "label": "Items",
      "type": "array",
      "input": "item-list",
      "required": true
    },
    {
      "field": "status",
      "label": "Status",
      "type": "string",
      "input": "readonly-badge",
      "required": true,
      "default": "draft"
    }
  ],
  "statuses": ["draft", "pending", "approved", "rejected", "queried", "delivered"],
  "audit": { "enabled": true, "trackedBy": ["createdBy", "updatedBy"] }
}
```

See **[phase-1.md](phase-1.md) §3** for the full format and every field's options.

---

## Contract Files to Create (your master list)

| Contract | Domain | Purpose |
|----------|--------|---------|
| `projects.json` | Project | Construction project / tender master data |
| `project_items.json` | Project | Master BOQ item list per project |
| `sites.json` | Project | Construction sites |
| `users.json` | Auth | User records & roles |
| `vendors.json` | Vendor | Vendor database |
| `material_request.json` | Procurement | Site Supervisor's request |
| `rfq.json` | Procurement | Request for Quotation |
| `cost_comparison.json` | Procurement | Vendor quote comparison |
| `purchase_order.json` | Procurement | Purchase Order |
| `delivery_challan.json` | Procurement | Delivery Challan |
| `grn.json` | Procurement | Goods Receipt Note |
| `inventory.json` | Inventory | Stock / inventory levels |
| `logs.json` | Audit | Audit trail entries |

---

## Convex Quick Login (short form)

Full step-by-step setup is in [phase-1.md](phase-1.md) §6. If you already know Convex:

```bash
npm install convex            # 1. add Convex
npx convex dev                # 2. opens browser → sign in with GitHub → create project → copy dev URL
# paste URL into .env.local as NEXT_PUBLIC_CONVEX_URL
npx convex dashboard          # 3. open the backend dashboard
```

---

## Principle of Continuous Updates

When a business flow changes (e.g. a new approval step):

1. **Edit the JSON contract** (`contracts/rfq.json`).
2. **Update the Convex schema/function** that the contract feeds (Phase 2 pattern).
3. **Update the form/UI** (Phase 3 pattern).
4. Update `user-flow.md` if the flow itself changed.

Because every layer reads from the contract, a change is **one small edit in one place**, not a scramble across the codebase.
