# Nirman — Construction Site ERP Platform

Internal ERP for construction site procurement: material requests from site → manager approval → RFQ → cost comparison → purchase order → delivery challan → goods receipt (GRN), with vendor & inventory management, audit trail, and role-based dashboards.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS v4 + Convex** (real-time backend & database).

## Getting Started

```bash
npm install
npx convex dev        # start Convex (run once to log in & link project)
npm run dev           # start Next.js dev server
```

Open [http://localhost:3000](http://localhost:3000).

> Requires a `.env.local` with `NEXT_PUBLIC_CONVEX_URL` (created automatically by `npx convex dev`).

## Docs

Design and build instructions live in [`../Build guide/_docs/`](../Build guide/_docs/) — read `project-overview.md`, `user-flow.md`, `project-rules.md`, `ui-rules.md`, and `theme-rules.md` before writing code. Phase-by-phase build roadmap: `../Build guide/_docs/updated phases/`.
