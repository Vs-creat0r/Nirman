# Phase 1 — Setup (Barebones Foundation)

> Goal: A running Next.js + Convex application with authentication, routing, and role-based access control working. No procurement features yet — just the shell.

---

## Deliverables

At the end of this phase, the application should:
- Launch at `http://localhost:3000`
- Authenticate users (login / logout)
- Route to the correct dashboard based on user role
- Display a responsive sidebar with navigation links
- Show an empty but correctly-styled dashboard per role

---

## Features

### 1. Project Bootstrap
1. Initialize Next.js app with TypeScript and App Router.
2. Install and configure Tailwind CSS v4.
3. Install Convex and run `npx convex dev` to initialize the backend.
4. Install Radix UI, React Hook Form, Zod, Lucide React.
5. Set up `tsconfig.json` path aliases (`@/` → project root).

### 2. Theme System
1. Create `styles/globals.css` with Tailwind base setup.
2. Create `styles/themes.css` with all CSS variable definitions from `theme-rules.md`.
3. Install and configure `next-themes` for light/dark mode.
4. Create `lib/theme.ts` with `initializeTheme()` and `setBrandTheme()`.
5. Test that `<html class="light theme-brand">` and `<html class="dark theme-brand">` apply correct colors.

### 3. Authentication
1. Define `users` table in `convex/schema.ts` with fields: name, email, role, isActive.
2. Implement JWT auth: `lib/auth.ts` for token generation and validation.
3. Create `app/(auth)/login/page.tsx` with login form (email + password).
4. Create auth middleware to protect all `/dashboard/*` routes.
5. Create `hooks/use-role.ts` returning current user's role.

### 4. Layout Shell
1. Create `app/(dashboard)/layout.tsx` with sidebar + header structure.
2. Create `components/layout/sidebar.tsx` with navigation links (role-aware).
3. Create `components/layout/header.tsx` with user menu, theme toggle.
4. Sidebar must collapse/expand with state persisted in localStorage.
5. Mobile: sidebar becomes a drawer overlay.

### 5. Role-based Dashboard Pages (Shells)
1. Create `app/(dashboard)/site/page.tsx` — empty shell with "Welcome, Site Supervisor" heading.
2. Create `app/(dashboard)/manager/page.tsx` — empty shell.
3. Create `app/(dashboard)/procurement/page.tsx` — empty shell.
4. Create `app/(dashboard)/admin/page.tsx` — empty shell.
5. Unauthorized role accessing wrong dashboard redirects to their own.

### 6. Base UI Components
1. Implement `components/ui/button.tsx` — all variants from `ui-rules.md`.
2. Implement `components/ui/badge.tsx` — status badge with color variants.
3. Implement `components/ui/input.tsx` and `components/ui/label.tsx`.
4. Implement `components/ui/card.tsx`.
5. Implement `components/ui/dialog.tsx` (wrapping Radix Dialog).

---

## Verification

- [ ] `npm run dev` starts without errors.
- [ ] Login page renders and accepts credentials.
- [ ] Each role redirects to the correct dashboard after login.
- [ ] Theme toggle switches between light and dark — all CSS variables apply correctly.
- [ ] Sidebar collapses and expands.
- [ ] Mobile: sidebar becomes a drawer.
- [ ] Unauthorized route access redirects to login.
