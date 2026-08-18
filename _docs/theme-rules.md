# Theme Rules

> Reference: `project-overview.md`, `ui-rules.md`
>
> This document defines all colors, typography, and visual tokens for the application's theme system.
> **No color value may be used in a component file directly — all colors must reference CSS variables defined here.**

---

## 1. Design Philosophy

The color palette for this system is built around **Blue, Yellow/Amber, and White** — a professional, high-contrast combination suited for a corporate construction management platform.

### Why This Palette?
- **Blue** conveys trust, stability, and authority — ideal for a procurement/approval system.
- **Amber/Yellow** signals attention and highlights action items without alarm — natural pair with deep blue in construction contexts.
- **White/Light Gray** surfaces keep the interface clean and scannable.
- The palette adapts between **light and dark modes** — amber/yellow is warmer in light mode, cooler and more vibrant in dark mode.

---

## 2. Two-Layer Theming Architecture

### Layer 1: Mode (Light / Dark)
- Controlled via `next-themes` + `.dark` class on `<html>`.
- User can toggle via the theme toggle in the header.
- Persisted in `localStorage`.

### Layer 2: Brand Theme
- Applied via `.theme-{brand}` class on `<html>`.
- Company-specific color values injected via CSS variables.
- Default brand: `theme-brand` (configure company name before launch).

### HTML Class Pattern
```html
<!-- Light mode -->
<html class="light theme-brand">

<!-- Dark mode -->
<html class="dark theme-brand">
```

---

## 3. Color Tokens — BRAND Theme

### 3.1 Light Mode Palette
```css
.theme-brand {
  /* Backgrounds */
  --background:       #F8FAFC;   /* Slate 50 — clean cool off-white */
  --surface:          #FFFFFF;   /* Card / panel background */
  --surface-elevated: #F1F5F9;   /* Slate 100 — secondary background */

  /* Primary — Slate Indigo */
  --primary:              #0F172A;   /* Slate 900 — deep indigo-slate */
  --primary-hover:        #1E293B;   /* Slate 800 */
  --primary-foreground:   #FFFFFF;   /* Text on primary */
  --primary-subtle:       #E2E8F0;   /* Slate 200 — subtle highlight bg */

  /* Accent — Bronze Amber (Actionable Highlights) */
  --accent:               #B45309;   /* Bronze Amber — rich, premium gold-brown */
  --accent-hover:         #92400E;   /* Bronze Amber Dark */
  --accent-foreground:    #FFFFFF;   /* Text on accent buttons */
  --accent-subtle:        #FFF7ED;   /* Warm orange tint */

  /* Text */
  --foreground:           #0F172A;   /* Primary text */
  --muted-foreground:     #64748B;   /* Slate 500 — muted placeholder text */

  /* Borders & Dividers */
  --border:               #E2E8F0;   /* Slate 200 — extra-thin border */
  --border-strong:        #CBD5E1;   /* Slate 300 — focus & active borders */
  --ring:                 #0F172A;   /* Focus ring — same as primary */

  /* UI Elements */
  --input:                #FFFFFF;   /* Input background */
  --radius:               6px;       /* Global border radius */

  /* Semantic Colors */
  --destructive:          #DC2626;   /* Error / Reject (Red 600) */
  --destructive-foreground: #FFFFFF;
  --success:              #16A34A;   /* Success / Delivered (Green 600) */
  --success-foreground:   #FFFFFF;
  --warning:              #CA8A04;   /* Warning / Pending (Yellow 600) */
  --warning-foreground:   #FFFFFF;
  --info:                 #0284C7;   /* Info (Cyan/Blue 600) */
  --info-foreground:      #FFFFFF;

  /* Muted / Inactive */
  --muted:                #F1F5F9;
  --secondary:            #E2E8F0;
  --secondary-foreground: #0F172A;
  --popover:              #FFFFFF;
  --popover-foreground:   #0F172A;
}
```

### 3.2 Dark Mode Palette
```css
.dark.theme-brand {
  /* Backgrounds */
  --background:       #0B0F19;   /* Deep luxury midnight navy */
  --surface:          #0F1524;   /* Deep navy card surface */
  --surface-elevated: #172033;   /* Elevated midnight navy panels */

  /* Primary — Ice/Sky Blue */
  --primary:              #38BDF8;   /* Sky blue 400 */
  --primary-hover:        #7DD3FC;   /* Sky blue 300 */
  --primary-foreground:   #090D16;   /* Dark text on sky blue buttons */
  --primary-subtle:       #1E293B;   /* Slate 800 */

  /* Accent — Amber */
  --accent:               #F59E0B;   /* Amber 500 */
  --accent-hover:         #FBBF24;   /* Amber 400 */
  --accent-foreground:    #090D16;   /* Dark text on bright accent buttons */
  --accent-subtle:        #451A03;   /* Warm dark amber tint */

  /* Text */
  --foreground:           #E2E8F0;   /* Slate 200 */
  --muted-foreground:     #94A3B8;   /* Slate 400 */

  /* Borders */
  --border:               #1E293B;   /* Slate 800 */
  --border-strong:        #334155;   /* Slate 700 */
  --ring:                 #38BDF8;

  /* UI Elements */
  --input:                #0F1524;
  --radius:               6px;

  /* Semantic Colors */
  --destructive:          #EF4444;   /* Red 500 */
  --destructive-foreground: #FFFFFF;
  --success:              #22C55E;   /* Green 500 */
  --success-foreground:   #0B0F19;
  --warning:              #EAB308;   /* Yellow 500 */
  --warning-foreground:   #0B0F19;
  --info:                 #38BDF8;   /* Sky blue */
  --info-foreground:      #0B0F19;

  /* Muted / Inactive */
  --muted:                #172033;
  --secondary:            #1E293B;
  --secondary-foreground: #E2E8F0;
  --popover:              #0F1524;
  --popover-foreground:   #E2E8F0;
}
```

---

## 4. Status Badge Colors

Status badges must be readable in both light and dark modes. Use semantic variables:

| Status | Variable | Light Value | Dark Value |
|---|---|---|---|
| `draft` | `--status-draft` | `#94A3B8` (slate) | `#64748B` |
| `pending` | `--status-pending` | `#D97706` (amber) | `#F59E0B` |
| `queried` | `--status-queried` | `#7C3AED` (violet) | `#A78BFA` |
| `ready_for_cc` | `--status-processing` | `#2563EB` (blue) | `#60A5FA` |
| `cc_pending` | `--status-processing` | `#2563EB` | `#60A5FA` |
| `ready_for_po` | `--status-processing` | `#2563EB` | `#60A5FA` |
| `pending_po` | `--status-processing` | `#2563EB` | `#60A5FA` |
| `ready_for_delivery` | `--status-delivery` | `#0891B2` (cyan) | `#22D3EE` |
| `delivery_processing` | `--status-delivery` | `#0891B2` | `#22D3EE` |
| `delivered` | `--status-success` | `#16A34A` (green) | `#22C55E` |
| `rejected` | `--status-danger` | `#DC2626` (red) | `#EF4444` |
| `cc_rejected` | `--status-danger` | `#DC2626` | `#EF4444` |

### CSS Definition
```css
.theme-brand {
  --status-draft:      #94A3B8;
  --status-pending:    #D97706;
  --status-queried:    #7C3AED;
  --status-processing: #2563EB;
  --status-delivery:   #0891B2;
  --status-success:    #16A34A;
  --status-danger:     #DC2626;
}

.dark.theme-brand {
  --status-draft:      #64748B;
  --status-pending:    #F59E0B;
  --status-queried:    #A78BFA;
  --status-processing: #60A5FA;
  --status-delivery:   #22D3EE;
  --status-success:    #22C55E;
  --status-danger:     #EF4444;
}
```

---

## 5. Typography

### 5.1 System Fonts
We utilize native iOS/Apple system fonts directly without external Google Font imports to optimize load speed and feel like a native desktop app:

### 5.2 Font Variables
```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, sans-serif;
--font-mono: "SF Mono", SFMono-Regular, ui-monospace, "SF Pro Mono", Consolas, monospace;
```

### 5.3 Weight Usage
| Weight | Value | Used For |
|---|---|---|
| Regular | `400` | Body text, input values |
| Medium | `500` | Labels, table headers |
| Semibold | `600` | Page titles, section headings, button text |
| Bold | `700` | Critical emphasis (use sparingly) |

---

## 6. Shadow Scale

Shadows are minimal — this is a corporate tool, not a consumer app.

```css
--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.06);  /* Input, badge */
--shadow-md:  0 2px 6px rgba(0, 0, 0, 0.08);  /* Card */
--shadow-lg:  0 4px 16px rgba(0, 0, 0, 0.12); /* Modal, dropdown */
```

In dark mode, reduce shadow opacity by ~40%:
```css
.dark.theme-brand {
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md:  0 2px 6px rgba(0, 0, 0, 0.25);
  --shadow-lg:  0 4px 16px rgba(0, 0, 0, 0.4);
}
```

---

## 7. Animation & Transitions

```css
--transition-fast:   150ms ease;   /* Hover states, focus rings */
--transition-normal: 200ms ease;   /* Color/opacity transitions */
--transition-slow:   300ms ease;   /* Modal open/close, sidebar expand */
```

**Rules:**
- Do **not** animate layout shifts (width/height changes).
- Respect `prefers-reduced-motion` — all animations must be wrapped:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 8. Adding a New Theme (Future Company)

### Step 1: Define CSS variables
```css
.theme-newcompany {
  --primary: #XXXXXX;
  /* ... all required tokens */
}
.dark.theme-newcompany {
  --primary: #YYYYYY;
  /* ... dark mode overrides */
}
```

### Step 2: Update TypeScript type
```typescript
// lib/theme.ts
export type BrandTheme = "brand" | "newcompany";
```

### Step 3: Update theme switcher
No component changes needed — all colors automatically apply via CSS variables.

---

## 9. Prohibited Patterns

- ❌ Hardcoded hex values in component files (e.g., `bg-[#1A3C6E]`)
- ❌ Different colors for different document types (e.g., blue for PO, green for DC)
- ❌ Inline style for colors (`style={{ color: '#...' }}`)
- ❌ Ignoring dark mode — every component must be tested in both modes
- ❌ Using yellow/amber as a primary background color in dark mode — it causes eye strain
- ❌ Very bright accent colors on white text in light mode — check contrast

---

## 10. Color Usage Rules

| Color | Allowed Use | NOT Allowed |
|---|---|---|
| `--primary` (Blue) | Nav, primary CTA buttons, active states, links | Section backgrounds, decorative elements |
| `--accent` (Amber) | Highlight badges, attention callouts, secondary CTAs | Entire card backgrounds, text |
| `--background` | Page background only | Card/surface background |
| `--surface` | Cards, panels, modals | Page background |
| `--destructive` | Delete/reject actions, error states only | Normal action buttons |
| `--success` | Completed/delivered status only | Positive non-completion states |

---

*Last Updated: Auto-maintained by AI agent.*
*Run a color accessibility audit (WCAG AA) whenever this document is updated.*
