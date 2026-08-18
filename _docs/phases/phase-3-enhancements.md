# Phase 3 — Enhancements (Polish & Expansion)

> Goal: Expand beyond MVP with Inventory Management, real-time chat, notifications, PWA support, and advanced features. This phase elevates the system from usable to excellent.

> Prerequisite: Phase 2 (MVP) must be complete and stable.

---

## Deliverables

At the end of this phase:
- Real-time chat works between roles.
- Inventory Management tracks on-site stock.
- PWA installed on site supervisors' phones.
- Excel export on all list views.
- Advanced dashboard analytics for managers.
- Admin can fully manage users, sites, and projects.

---

## Features

### 1. Real-time Chat System
1. Define `conversations` and `messages` tables in Convex schema.
2. Implement `convex/chat.ts`: `sendMessage`, `getConversations`, `getMessages`, `markAsRead`.
3. Implement `convex/presence.ts`: heartbeat, online/offline tracking.
4. Create `components/chat/` — ChatWindow, ConversationList, MessageList, MessageInput, OnlineIndicator.
5. Role-based chat permissions (see `user-flow.md` § 6.1).

### 2. Notification System
1. In-app toast notifications for: status changes, approvals, new messages.
2. Header notification bell with unread count badge.
3. Notification preferences per user (mute conversation, etc.).
4. Browser notifications (with permission).
5. Implement `lib/notifications.ts`.

### 3. Inventory Management
1. Define `inventory` table: materialCategory, quantity, unit, warehouseLocation, lastUpdated.
2. Auto-update inventory stock when GRN is listed.
3. Create `app/(dashboard)/inventory/page.tsx` — stock levels table.
4. Low-stock alerts: flag items below threshold.
5. Inventory history: track all changes with audit log.

### 4. PWA Support
1. Create `public/manifest.json` with app name, icons, theme colors.
2. Register service worker for offline capability.
3. Implement `hooks/use-pwa.ts` — detect installability, prompt install.
4. Show "Add to Home Screen" prompt for site supervisors on mobile.
5. Cache critical assets for offline GRN submission.

### 5. Excel Exports (All Modules)
1. Standardize `lib/excel.ts` with a single `exportToExcel(data, config)` function.
2. Add export button to all list views: Requests, RFQs, CCs, POs, DCs, GRN, Vendors, Inventory.
3. Excel files: colored headers, auto column widths, filter enabled, with images.
4. File naming: `{DocumentType}_{Date}_{CompanyName}.xlsx`.

### 6. PDF Generation (Enhanced)
1. PO PDF: branded header, company logo, vendor details, line items, totals, signatures.
2. DC PDF: dispatch details, items, QR code.
<!-- Not needed 3. GRN PDF: receipt confirmation with quantities, signatures. -->
3. All PDFs use consistent brand colors from theme system.

### 7. Admin Panel
1. `app/(dashboard)/admin/users/page.tsx` — create/edit/deactivate users.
2. `app/(dashboard)/admin/sites/page.tsx` — manage construction sites and projects.
3. `app/(dashboard)/admin/settings/page.tsx` — system settings.
4. Role assignment: Admin is the only one who can assign roles.
5. Audit log viewer: Admin can see all system actions.

### 8. Manager Analytics Dashboard
1. Summary KPI cards: Total spend this month, Active POs, Pending approvals, Deliveries.
2. Request pipeline chart: funnel from pending → delivered.
3. Vendor performance table: on-time delivery %, average quote price.
4. Top 5 highest-cost requests.
5. Use Recharts for all charts — apply brand colors from theme variables.

### 9. Advanced Search & Filtering
1. Global search across all modules (requests, vendors, POs).
2. Date range filter button on all list views.
3. Status multi-filter on all list views.
4. Site/Project filter for managers.
5. Results update in real-time as filters change.

---

## Future Phases (Planned, Not Scheduled)

> These are captured here for planning purposes. They will be broken into their own phase documents when development begins.

### Phase 4 — Project Intelligence
- **Project Management**: Milestone tracking, project timeline, progress %.
- **Labor Management**: Agency posting, daily manpower, billing, credit balancing.
- **Material Consumption Tracking**: Day-by-day assembly progress, consumption vs. delivered.
- **Accountant Role**: Financial views, pending payments, cost reports, P&L per project.

### Phase 5 — Advanced Integrations
- **WhatsApp / Email Notifications**: Notify vendors when PO is issued.
- **Vendor Portal**: External-facing portal where vendors log in to view POs.
- **ERP Integration**: Connect with external accounting software (Tally, SAP, etc.).
- **Geospatial Tracking**: Delivery truck GPS tracking on site map.

### Phase 6 — Monetization & Premium Features (SaaS Model)
- **Global Vendor Discovery**: A premium feature where the system searches the internet (via scraping/research APIs) to suggest top-rated, lowest-cost vendors for specific items, extending beyond the user's internal vendor list.
- **Sponsored Vendor Rankings**: An advertising model where vendors can pay a commission or ad fee to rank higher in the platform's auto-suggestions (during Cost Comparisons or RFQs), allowing them to push discounted rates.
- **Predictive Pricing Analytics (Idea)**: AI-driven market analysis that tracks historical material prices (e.g., steel, cement) and advises the Project Manager on the best time to issue POs.
- **Reverse Auction Bidding (Idea)**: A portal where invited vendors can blindly bid against each other on RFQs in real-time to drive material costs down for the user.
- **Automated Invoice OCR (Idea)**: Premium capability to scan physical bills and delivery challans, automatically extracting quantities and costs without manual data entry.

---

*Last Updated: Auto-maintained by AI agent.*
*When a future phase begins development, create a dedicated phase document.*
