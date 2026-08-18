# Stitch Design Brief — Construction ERP Platform

Built from your `_docs/` files. Assumption: by "ZGPD-style" you mean ultra-minimal, single-focus SaaS UI (ChatGPT/Linear/Notion-level restraint) — that's the direction used below, and it also sets up the future agentic-AI layer (Section 4) naturally.

**How to use:** Paste Section 2 first → generate → then paste each Section 3 block as a separate prompt, one screen at a time (Stitch works best incremental, not all-at-once). Keep Section 1 open and reference it in every prompt. Use Section 6 when refining.

---

## 1. Design Tokens (paste/reference in every prompt)

```
Palette — Light: bg #F4F7FB, surface #FFFFFF, primary #1A3C6E (deep blue), 
accent #D97706 (amber, used ONLY for highlights/CTAs, never backgrounds), 
text #0F1C2E, muted-text #56687A, border #D1DCE9, 
destructive #DC2626, success #16A34A, warning #CA8A04.

Palette — Dark: bg #0D1B2A, surface #132337, primary #4A90D9, accent #F59E0B, 
text #E2EAF5, muted-text #7A97B8, border #1F3554.

Typography: Inter. Weights: 400 body, 500 labels, 600 headings, 700 rare emphasis.
Scale: page title 24px/semibold, section 18px/semibold, body 14px, label/caption 12px.

Radius: 6px on inputs/buttons/cards. 8px on modals. 4px on badges. Full round only on avatars.
NEVER rounded-xl / rounded-2xl on any container.

Shadows: near-flat. sm = 0 1px 2px rgba(0,0,0,.06). md = card only. No glows, no drop shadows on buttons.
No gradients anywhere. No decorative illustrations. This is a corporate tool, not a consumer app.
```

---

## 2. Master Foundation Prompt (generate this first)

```
Idea: A production-grade B2B SaaS web app — a Construction Site ERP that runs 
procurement end-to-end: material requests from site → manager approval → vendor 
quotes → purchase order → delivery → receipt confirmation. Three internal user 
roles (Site Supervisor, Project Manager, Procurement Officer) plus an Admin, each 
with a different dashboard behind the same shell.

Theme: Minimal, calm, high-trust enterprise software — the opposite of a busy 
admin template. Think Linear or Notion's restraint applied to an ERP: one clear 
focal action per screen, generous whitespace, no decorative chrome, no clutter. 
Corporate blue (#1A3C6E) as the only structural color, amber (#D97706) reserved 
strictly for the one thing that needs attention. Light and dark mode both required, 
same layout, token-driven color swap only.

Layout foundation: Fixed 64px header, collapsible 240px left sidebar (icon-only 
at 64px collapsed), content area max-width ~1200px centered with real margin — 
never edge-to-edge tables. Every page has exactly one primary action, top-right, 
always in the same position.

Content: Design the app shell first — header (logo, search, notification bell, 
user menu) + sidebar (role-aware nav groups: Dashboard, Procurement [RFQ, Purchase 
Orders, Pending POs, Delivery], Supply [Vendors, Inventory, GRN, Logs], Chat) + an 
empty content canvas. Show both light and dark mode of this shell.

Constraint: Do not add multi-column dashboards with 6+ widgets, no heavy data-dense 
grids, no gradients, no rounded-xl cards. Favor one strong hierarchy over many small 
boxes.
```

---

## 3. Screen-by-Screen Prompts

Paste each separately, after the foundation shell exists.

### 3.1 Marketing / Landing Page (public site — for selling this to companies)

```
Design a marketing landing page for this Construction ERP product, aimed at 
construction company owners and procurement heads evaluating software. 

Structure (single column, generous vertical rhythm, nothing cramped):
1. Header — logo left, 3-4 nav links, one primary "Book a demo" button, no dropdown mega-menus.
2. Hero — one headline (max 8 words) about eliminating manual procurement paperwork, 
   one supporting line, one primary CTA, one secondary "See how it works" link. 
   A single clean product screenshot/mock, not a busy illustration.
3. Trust bar — logos row, small and quiet.
4. Three-step "how it works" — Request → Approve → Deliver, shown as a simple 
   horizontal flow, not a diagram with arrows everywhere.
5. One feature section per row (alternating image/text), max 4 features total — 
   not a 9-icon grid.
6. Simple pricing or "talk to sales" band.
7. Footer — minimal, 3 columns max.

Style: same tokens as the app (blue/amber/white), but landing page can breathe more 
— larger type, more whitespace than the dashboard. No stock-photo people, no gradient 
blobs, no glassmorphism. This must look like it belongs to a company already running 
production software, not a template.
```

### 3.2 Login

```
Design the login screen. Centered card, max-width 400px, on a plain token-colored 
background (no image, no split-screen marketing panel — this is an internal tool). 
Logo, email field, password field, one primary "Sign in" button, "Forgot password" 
link below. No social login, no signup link (users are created by Admin only). 
Show both light and dark mode.
```

### 3.3 Universal Document Form — shell + one adaptive body (Material Request)

```
Design the Universal Document Form used for every document type in this app 
(Material Request, RFQ, Cost Comparison, Purchase Order, Delivery Challan, GRN — 
same shell, only the body changes). Show the Material Request variant, create mode.

Structure top to bottom:
- Header row: back arrow, document title + small type badge, role-gated action 
  buttons top-right (max 2 visible at once, rest in a "..." menu).
- Meta row: status badge, created-by, date, document ID — single quiet line, 
  small text, not boxed.
- Body: Project + Site selectors, then an item list (name, qty, unit) added one 
  row at a time via a "+ Add item" row-style input (not a modal) — item name field 
  shows autocomplete suggestions from inventory as the user types.
- Notes textarea, always visible, collapium not needed.
- Sticky footer: Cancel (left, outline), Save Draft + Submit (right, submit is 
  the one primary-colored button on the page).

Rule: this exact shell/skeleton must be able to hold RFQ (vendor picker + items), 
Cost Comparison (side-by-side vendor quote table), Purchase Order (vendor + line 
items + payment terms), Delivery Challan (vehicle/driver + dispatch items), GRN 
(read-only receipt summary) without changing header/footer/meta structure — only 
the middle body region adapts.
```

### 3.4 Site Supervisor Dashboard

```
Design the Site Supervisor's dashboard (lowest-complexity role — they only create 
and track requests). Two summary numbers at top (Active Requests, Deliveries Today) 
as plain stat cards, not a 4-card grid forcing empty slots. Below: a single list of 
"My Requests" with status badge, project/site, date — one primary "New Request" 
button top-right. No charts, no secondary widgets. This screen should feel like a 
focused to-do list, not a control room.
```

### 3.5 Project Manager Dashboard

```
Design the Project Manager's dashboard — highest authority, so give them a 
"Pending Approvals" list front and center (request/CC/PO items awaiting their 
decision, each row showing type badge + one-line context + Approve/Query/Reject 
inline or via row click), plus a small real-time activity feed underneath 
(not sidebar-mounted — full width, quiet). Include a "Create New" button (dropdown: 
RFQ / PO / CC / DC) top-right since Managers can create directly. Keep it to two 
sections max on this screen — approvals queue, then activity — resist adding more 
panels.
```

### 3.6 Procurement Officer Dashboard

```
Design the Procurement Officer's dashboard as a single horizontal pipeline strip 
showing count-at-each-stage (RFQ → CC Review → PO Review → Pending PO → Delivery) 
as simple numbered stage chips, not a heavy Kanban board. Below the pipeline, one 
"Needs your attention" list mixing items across stages. No more than these two 
regions on the page.
```

### 3.7 Admin Dashboard + User Management

```
Design the Admin's user management page: a clean table (Name, Email, Role, 
Status, last row action menu), search bar above, "+ Add User" primary button 
top-right. Table max 5 columns visible on desktop, collapses to 2-3 on mobile. 
Empty state and skeleton loading state included.
```

### 3.8 Document List View (generic — reused for RFQ / PO / DC list pages)

```
Design a generic document list page (works for RFQ list, PO list, Delivery list). 
Top bar: page title, search input, status filter, date range filter, "+ New" 
primary button — all in one row, no filter sidebar. Table below: document ID, 
type/vendor, status badge (icon + text, never color-only), date, single row-action 
menu. Sort by date default. Include empty state (quiet illustration + one-line 
message + CTA) and skeleton-row loading state — never a spinner.
```

### 3.9 Vendor Selection / Add Vendor

```
Design the vendor picker used inside RFQ/PO/CC forms: a searchable dropdown where 
already-selected vendors are grouped at the top under "✓ Already Added" and the 
rest under "Available Vendors" — never mixed. Also design the standalone "Add 
Vendor" modal (max-w-lg): Name, Contact, GST, Address, Category, with inline 
duplicate-name validation shown below the Name field before submit.
```

### 3.10 Empty / Loading / Error States (system-wide)

```
Design the three system-wide states used across every list and dashboard: 
(1) Empty state — one small quiet icon, one sentence, one CTA, vertically centered, 
no clutter. (2) Loading state — skeleton rows/cards matching real layout, no spinners. 
(3) Error/inline validation state — destructive-color text below the field or a 
small inline banner, never a full-page red screen.
```

### 3.11 Mobile Pass

```
Take the app shell and the Site Supervisor dashboard (this role is mobile-first, 
used on-site on phones) and redesign for mobile: sidebar becomes a bottom-opened 
drawer, header collapses to logo + hamburger + user avatar, table columns drop to 
2, "New Request" becomes a fixed bottom-right FAB. Keep the same tokens, same 
minimal density — mobile is not the place to add more UI, it's the place to remove more.
```

---

## 4. Agentic AI Layer (design now, wire up later)

Reserve the visual space today so the AI feature slots in later without a redesign.

```
Add two AI-ready elements to the app shell, styled but non-functional for now:
(1) A command-bar trigger in the header — a subtle input-like button reading 
"Ask AI to create anything... (⌘K)" — opens a centered command palette overlay 
(search-style, max-w-lg, single input + suggested actions list beneath: "Create 
material request", "Find vendor", "Show pending approvals").
(2) A floating AI assistant affordance (small circular button, bottom-right, 
same primary blue, no glow/pulse animation) that opens a slide-over side panel 
(chat-style: message list + input at bottom) where a user could type "create an 
RFQ for 200 bags of cement" and see it turn into a filled Universal Document Form.

Keep both visually quiet — same tokens, same restraint. This is a power feature 
for later, not a decoration now.
```

---

## 5. Non-Negotiable UX & Performance Rules (apply to every screen you generate)

- One primary CTA per screen, always same position (top-right of header row).
- Max content width ~1200px, centered, real margins — no edge-to-edge tables/cards.
- Tables: 5-6 visible columns max on desktop, 2-3 on mobile; overflow goes behind a row menu, not horizontal scroll.
- Status is always icon + text label — never color alone.
- Every list/page needs an empty state and a skeleton-loading state — never a bare spinner or blank screen.
- No animation except modal open/close and toasts — no hover-lift cards, no scroll-triggered reveals in the app (marketing page can have very light entrance fades only).
- Dark mode is not optional — every screen shown in both.
- WCAG AA contrast minimum on all text/badge combinations.
- No stock imagery, no illustrations-as-filler, no gradient backgrounds anywhere.
- Fewer DOM-heavy elements per screen = faster real build later — prefer one clear list/table over multiple competing widgets.

---

## 6. Iteration Tips (once first drafts exist)

- Refine one screen and one change at a time — e.g. "Increase spacing between sidebar nav items" not "make it nicer."
- Target elements by name explicitly: "Move the status badge in DocumentMeta to the right side" not "fix the header."
- If a generated screen adds clutter you didn't ask for, say so directly: "Remove the extra widgets, keep only the approvals list and the activity feed."
- Do the full flow broad-to-narrow: shell → dashboards → Universal Document Form → list views → mobile pass → AI layer last.
