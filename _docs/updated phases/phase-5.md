# Phase 5 — Advanced Features & Automation

> **Goal:** Layer advanced capabilities on top of the stable, contract-driven core — n8n webhooks, real-time chat, notifications, inventory management, voice/AI input, and production deployment hardening. These features slot in *without* destabilizing the data model because the core is contract-driven.
>
> **Read first:** `phase-4.md` (stable core), `phase-3.md` (component library), `_docs/user-flow.md`, `_docs/tech-stack.md`.
>
> **Prerequisites:** Phase 1–4 complete and verified. The full procurement flow works end-to-end.

---

## Deliverables

At the end of this phase:

- n8n webhooks triggered by Convex status changes (e.g. vendor notification on PO approval).
- Real-time chat between roles + notification bell with unread counts.
- Inventory management with low-stock alerts and GRN-driven auto-updates.
- Voice-to-text input over the Universal Document Form (hands-free entry).
- Production deployment ready: build passes, env separated, secrets safe, Convex production project live.
- Excel/PDF export on list views (per Phase 3 docs).
- Performance + security hardening pass.

---

## Task 1 — Production deployment baseline

Before adding features, ensure you can ship what you have:

1. **Separate dev vs production Convex projects** — create a production deployment:
   ```bash
   npx convex deploy --prod
   ```
   This creates a prod deployment with its own URL → new `CONVEX_URL` for prod.

2. **Environment separation:**
   - `.env.local` (dev secrets — gitignored)
   - `.env.production` or Vercel/self-host env vars (prod secrets — never committed)

3. **Build check:**
   ```bash
   npm run build
   ```
   Fix any type errors, unused imports, or hydration warnings. This is your quality gate.

4. **Error tracking (recommended):** add Sentry or a minimal `lib/error-reporting.ts` that captures client + server errors.

5. **HTTPS + security headers:** in production, ensure headers like `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP (Next.js `headers()` in `next.config.ts`).

### Verification — Task 1
- [ ] `npm run build` passes with zero errors.
- [ ] Prod Convex URL + prod secrets live only in prod env.
- [ ] Security headers configured.
- [ ] The app runs from a production build (`npm run start`) on localhost.

---

## Task 2 — n8n webhooks (automation)

Automate external workflows by firing webhooks when Convex data changes.

1. **HTTP action** — a Convex `action` that calls an n8n webhook URL:

   ```ts
   // convex/automation.ts
   import { action } from "../_generated/server";
   import { v } from "convex/values";

   export const notifyStatusChange = action({
     args: { documentType: v.string(), documentId: v.id("purchaseOrders"), status: v.string() },
     handler: async (ctx, args) => {
       const url = process.env.N8N_WEBHOOK_URL; // server-side secret
       if (!url) return { skipped: true };
       await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ ...args, triggeredAt: Date.now() }),
       });
       return { skipped: false };
     },
   });
   ```

   > `action` runs on the Convex server (has access to env secrets); `process.env.N8N_WEBHOOK_URL` is server-only.

2. **Trigger points** — call `notifyStatusChange` inside existing mutations at meaningful transitions (e.g. after `approveRequest`, `markDelivered`). Because the mutation already writes the audit log, this is a single extra call.

3. **n8n side** — create a workflow with a Webhook trigger node; parse the payload; add nodes for:
   - Email/WhatsApp vendor notification
   - Slack/Teams alert to managers
   - Google Sheets append (reporting)

4. **Security:**
   - Add a shared secret header to webhook calls (n8n "Header Auth") and verify it server-side before processing.
   - Never put the webhook URL in client code — it's server-side only.

### Verification — Task 2
- [ ] n8n webhook receives a POST when a PO is approved (check n8n execution logs).
- [ ] A downstream node (e.g. Slack message) fires.
- [ ] Requests without the secret header are rejected.

---

## Task 3 — Real-time chat

Per `phase-3-enhancements.md`:

1. **Schema** (`convex/schema.ts`):
   - `conversations`: `participantIds[]`, `documentId?` (optional link to a document), `createdAt`.
   - `messages`: `conversationId`, `senderId`, `body`, `readBy[]`, `_creationTime`.

2. **Functions** (`convex/chat.ts`): `sendMessage`, `listConversations`, `listMessages`, `markConversationRead`.

3. **UI** (`components/chat/`): ChatWindow, ConversationList, MessageList, MessageInput, OnlineIndicator.

4. Role permissions per `user-flow.md` §6.1: participants can message; online presence via a heartbeat (`convex/presence.ts`).

### Verification — Task 3
- [ ] Two users in a conversation exchange messages in real time.
- [ ] Unread indicator increments for the non-sender.
- [ ] Only conversation participants can read it.

---

## Task 4 — Notification system

1. **Schema** — `notifications` table: `userId`, `title`, `body`, `type`, `read`, `createdAt`, `linkTo`.

2. **Function** — `convex/notifications.ts`: `pushNotification`, `listMyNotifications`, `markAllRead`.

3. **Emit points** — call `pushNotification` from the same mutations that fire webhooks (approval needed, request approved, delivery dispatched, etc.).

4. **UI** — header bell with unread badge + dropdown list; toast on new notification. Notification preferences per user (mute conversation, quiet hours).

### Verification — Task 4
- [ ] Approving a request creates a notification for the requester.
- [ ] Bell shows unread count, updates in real time.
- [ ] Marking read clears the badge.

---

## Task 5 — Inventory management

Per `phase-3-enhancements.md` §3:

1. **Schema** — `inventory` table (already in contracts): `materialCategory`, `quantity`, `unit`, `warehouseLocation`, `lastUpdated`.

2. **GRN-driven updates** — when a GRN is confirmed (Phase 4 flow), adjust inventory:
   - New item not in inventory → insert.
   - Existing item → increment quantity.
   - Always write an `inventoryLog` row (audit).

3. **Functions** — `adjustStock`, `listInventory`, `lowStock` (below threshold), `setThreshold`.

4. **UI** — inventory page (`app/(dashboard)/inventory/page.tsx`): stock table, low-stock flags, category filter, Excel export.

### Verification — Task 5
- [ ] Confirming a GRN increments inventory correctly.
- [ ] Items below threshold are flagged.
- [ ] Inventory history shows every adjustment with actor + timestamp.

---

## Task 6 — Voice-to-text & AI-assisted input

Add hands-free data entry on top of the Universal DocumentForm (safe because the core is stable).

1. **Voice-to-text:**
   - Use the Web Speech API (`SpeechRecognition`) — no backend needed.
   - Create `components/voice-input.tsx` — a mic button beside any text field; on stop, inserts recognized text.
   - Fallback message if the browser doesn't support it.

2. **Optional AI intent parsing** (future agent layer, per `stitch-design-brief.md` §4):
   - An n8n/AI endpoint that takes natural language ("50 bags cement urgent to site A") and returns the structured `materialRequest` object.
   - Then prefill the DocumentForm via `initialData` — the form stays identical.

### Security notes
- Voice/AI text is user input — it goes through the same server validators as typed input. Never trust the model's output.
- Keep the AI endpoint server-side (never expose an API key in client code).

### Verification — Task 6
- [ ] Mic button transcribes speech into a field.
- [ ] Voice-produced data passes the same validation and creates a valid document.
- [ ] Non-supporting browsers show a graceful fallback.

---

## Task 7 — Excel/PDF export

1. **Excel** — `npm install xlsx`; create `lib/export/excel.ts` with `exportToExcel(rows, filename)`; add an "Export" button to list views.
2. **PDF** — `npm install jspdf html2canvas`; `lib/export/pdf.ts` with `exportToPdf(node, filename)` for documents (PO/DC printable format per `tech-stack.md`).
3. Respect role access: exports respect the same queries the view uses (no new data exposure).

### Verification — Task 7
- [ ] Exporting a PO list produces a valid `.xlsx`.
- [ ] A PO renders as a clean printable PDF.

---

## Task 8 — Performance & security hardening (final pass)

### Performance
- [ ] `npm run build` passes with no bundle warnings; lazy-load heavy pages (`dynamic` import) for chat/export.
- [ ] List pages use Convex pagination (`paginatedQuery`) instead of loading everything when datasets grow.
- [ ] Audit images/uploads: R2 URLs with short-lived signed URLs; don't embed heavy blobs in docs.

### Security (final)
- [ ] Full re-scan: no secrets in client bundles (`grep -r "JWT_SECRET\|N8N_WEBHOOK\|passwordHash" app/`).
- [ ] Convex **rate limits** on: login, public queries, webhook-triggering mutations.
- [ ] Role guards reviewed on every new function added this phase (chat, notifications, inventory).
- [ ] `npm audit --audit-level=high` clean.
- [ ] CSRF-safe: state-changing requests are same-site (cookie auth + Convex mutation guards).

---

## Phase 5 — Final Verification

- [ ] Production build passes + runs from `npm run start` (Task 1).
- [ ] n8n webhook fires and a downstream action completes (Task 2).
- [ ] Chat + notifications work in real time, role-scoped (Tasks 3–4).
- [ ] Inventory updates from GRNs + low-stock alerts work (Task 5).
- [ ] Voice input + AI prefill work on the DocumentForm (Task 6).
- [ ] Excel/PDF export works (Task 7).
- [ ] Performance + security hardening checklist green (Task 8).

---

## Platform Complete ✅

You now have a production-grade, contract-driven Construction Site ERP:

- **Simple to update:** change a JSON contract → regenerate schema/form → deploy.
- **Easy to use:** role-aware UI, status-first design, smart autocomplete.
- **Professional & production-ready:** theme system, audit trail, security baseline, real-time data.

**Recommended next steps:**
1. Document any flow changes you make in `user-flow.md` + the affected contract.
2. Set up CI (`npx convex deploy` + `npm run build` on push) so every change is verified.
3. Add tests for the critical path (request → GRN) so future edits stay safe.
