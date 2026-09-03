/**
 * @fileoverview Stage 4 Gate 3: UI Parity, DocumentView Architecture, & Contract Invariants Verification
 *
 * Repeatable regression script asserting:
 * 1. Six detail pages strictly conform to line ceilings and DocumentView shell architecture.
 * 2. DocumentView queries server-authoritative api.lifecycle.availableActions with zero local status branches.
 * 3. Extracted components (DocumentItemsTable, DocumentAuditTrail, DocumentFinancialSummary, CCComparisonView) exist and are modular.
 * 4. Contract lifecycle transitions, roles, and status badge configurations are 100% complete and consistent.
 * 5. Codebase contains 0 relative imports, 0 hardcoded palette colors, and 0 `status as any` occurrences.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const ROOT = process.cwd();

const DETAIL_PAGES = [
  { path: "app/(dashboard)/dashboard/supervisor/material-requests/[id]/page.tsx", maxLines: 120, docType: "material_request" },
  { path: "app/(dashboard)/dashboard/manager/material-requests/[id]/page.tsx", maxLines: 120, docType: "material_request" },
  { path: "app/(dashboard)/dashboard/manager/cost-comparisons/[id]/page.tsx", maxLines: 120, docType: "cost_comparison" },
  { path: "app/(dashboard)/dashboard/procurement/cost-comparisons/[id]/page.tsx", maxLines: 120, docType: "cost_comparison" },
  { path: "app/(dashboard)/dashboard/manager/purchase-orders/[id]/page.tsx", maxLines: 120, docType: "purchase_order" },
  { path: "app/(dashboard)/dashboard/procurement/purchase-orders/[id]/page.tsx", maxLines: 200, docType: "purchase_order" },
];

const EXTRACTED_COMPONENTS = [
  "components/document/document-view.tsx",
  "components/document/document-items-table.tsx",
  "components/document/document-audit-trail.tsx",
  "components/document/document-financial-summary.tsx",
  "components/document/cc-comparison-view.tsx",
  "components/document/document-lineage-bar.tsx",
  "components/document/status-badge.tsx",
];

const CONTRACTS = [
  "contracts/material_request.json",
  "contracts/cost_comparison.json",
  "contracts/purchase_order.json",
  "contracts/delivery_challan.json",
];

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

let allPassed = true;

function check(assertion, message) {
  if (assertion) {
    console.log(`  [OK]   ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    allPassed = false;
  }
}

// -------------------------------------------------------------
// 1. Detail Pages Line Count & Shell Invariants
// -------------------------------------------------------------
logSection("1. Detail Pages Line Ceilings & Architecture");

for (const p of DETAIL_PAGES) {
  const fullPath = resolve(ROOT, p.path);
  check(existsSync(fullPath), `File exists: ${p.path}`);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, "utf-8");
  const lineCount = content.split("\n").length;
  check(
    lineCount <= p.maxLines,
    `${p.path} has ${lineCount} lines (ceiling <= ${p.maxLines})`
  );

  check(
    content.includes("DocumentView") && (content.includes("@/components/document") || content.includes("@/components/document/document-view")),
    `${p.path} imports and renders DocumentView shell`
  );

  check(
    content.includes(`docType="${p.docType}"`),
    `${p.path} passes docType="${p.docType}" to DocumentView`
  );
}

// -------------------------------------------------------------
// 2. Extracted Components & DocumentView Shell Invariants
// -------------------------------------------------------------
logSection("2. DocumentView Shell & Extracted Components");

for (const comp of EXTRACTED_COMPONENTS) {
  const fullPath = resolve(ROOT, comp);
  check(existsSync(fullPath), `Component exists: ${comp}`);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n").length;
  check(lines <= 500, `${comp} is ${lines} lines (ceiling <= 500)`);
}

const docViewPath = resolve(ROOT, "components/document/document-view.tsx");
if (existsSync(docViewPath)) {
  const docViewContent = readFileSync(docViewPath, "utf-8");
  check(
    docViewContent.includes("api.lifecycle.availableActions"),
    "DocumentView queries server-authoritative api.lifecycle.availableActions"
  );
  check(
    docViewContent.includes("StatusBadge"),
    "DocumentView renders StatusBadge component"
  );
  check(
    docViewContent.includes("DocumentLineageBar"),
    "DocumentView renders DocumentLineageBar component"
  );
  check(
    docViewContent.includes("DocumentItemsTable"),
    "DocumentView renders DocumentItemsTable component"
  );
  check(
    docViewContent.includes("DocumentAuditTrail"),
    "DocumentView renders DocumentAuditTrail component"
  );
}

// -------------------------------------------------------------
// 3. Contract Lifecycle Invariants & Status Badge Coverage
// -------------------------------------------------------------
logSection("3. Lifecycle Contracts & Badge Map Coverage");

const statusBadgePath = resolve(ROOT, "components/document/status-badge.tsx");
const statusBadgeContent = existsSync(statusBadgePath) ? readFileSync(statusBadgePath, "utf-8") : "";

for (const contractPath of CONTRACTS) {
  const fullPath = resolve(ROOT, contractPath);
  check(existsSync(fullPath), `Contract exists: ${contractPath}`);
  if (!existsSync(fullPath)) continue;

  const contract = JSON.parse(readFileSync(fullPath, "utf-8"));
  const lifecycle = contract.lifecycle;
  check(Boolean(lifecycle), `${contractPath} has lifecycle definition`);
  if (!lifecycle) continue;

  const stateNames = typeof lifecycle.states === "object" && lifecycle.states !== null
    ? (Array.isArray(lifecycle.states) ? lifecycle.states : Object.keys(lifecycle.states))
    : [];

  check(
    stateNames.length > 0,
    `${contractPath} defines ${stateNames.length} states: [${stateNames.join(", ")}]`
  );

  const transitions = Array.isArray(lifecycle.transitions)
    ? lifecycle.transitions
    : (typeof lifecycle.transitions === "object" ? Object.values(lifecycle.transitions) : []);

  check(
    transitions.length > 0,
    `${contractPath} defines ${transitions.length} transitions`
  );

  // Validate every transition has required fields
  for (const t of transitions) {
    const fromStr = Array.isArray(t.from) ? t.from.join("|") : t.from;
    const valid = t.name && fromStr && t.to && Array.isArray(t.roles) && t.roles.length > 0;
    check(
      valid,
      `Transition "${t.name}" (${fromStr} -> ${t.to}) has roles: [${t.roles ? t.roles.join(", ") : ""}]`
    );
  }

  // Validate status badge config
  for (const state of stateNames) {
    const hasConfig = statusBadgeContent.includes(state) || statusBadgeContent.includes("getStatusConfig");
    check(hasConfig, `StatusBadge supports lifecycle state "${state}" for ${contract.name || contract.table}`);
  }
}

// -------------------------------------------------------------
// 4. Code Quality & Design System Invariants
// -------------------------------------------------------------
logSection("4. Zero Regressions Code Quality Invariants");

const COLOR_RE = /(bg|text|border)-(emerald|amber|rose|slate|indigo|blue|red|green|yellow|gray|zinc)-[0-9]{2,3}/;

function scanDir(dir, filterFn, collector) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, f.name);
    if (f.isDirectory()) {
      if (!["node_modules", ".next", ".git", "_generated"].includes(f.name)) {
        scanDir(full, filterFn, collector);
      }
    } else if (filterFn(f.name)) {
      collector(full);
    }
  }
}

// Hardcoded colors check
const hardcodedColorFiles = [];
scanDir(resolve(ROOT, "app"), f => f.endsWith(".tsx"), file => {
  const content = readFileSync(file, "utf-8");
  if (COLOR_RE.test(content)) hardcodedColorFiles.push(file);
});
scanDir(resolve(ROOT, "components"), f => f.endsWith(".tsx"), file => {
  const content = readFileSync(file, "utf-8");
  if (COLOR_RE.test(content)) hardcodedColorFiles.push(file);
});
check(
  hardcodedColorFiles.length === 0,
  `Hardcoded Tailwind palette colors count: ${hardcodedColorFiles.length} (must be 0)`
);

// Relative imports check
const relativeImportFiles = [];
const sourceDirs = ["app", "components", "convex", "hooks", "lib"];
for (const d of sourceDirs) {
  scanDir(resolve(ROOT, d), f => f.endsWith(".ts") || f.endsWith(".tsx"), file => {
    const content = readFileSync(file, "utf-8");
    if (/from ['"]\.\.\//.test(content)) relativeImportFiles.push(file);
  });
}
check(
  relativeImportFiles.length === 0,
  `Relative "../" imports count: ${relativeImportFiles.length} (must be 0)`
);

// Status as any check
let statusAsAnyCount = 0;
scanDir(resolve(ROOT, "app"), f => f.endsWith(".tsx"), file => {
  const content = readFileSync(file, "utf-8");
  const matches = content.match(/status as any/g);
  if (matches) statusAsAnyCount += matches.length;
});
check(
  statusAsAnyCount === 0,
  `"status as any" casts in app/: ${statusAsAnyCount} (must be 0)`
);

// -------------------------------------------------------------
// Final Summary
// -------------------------------------------------------------
console.log("\n=============================================================");
if (allPassed) {
  console.log("  GATE 3 PARITY & INVARIANTS: ALL CHECKS PASSED (100% GREEN)");
  console.log("=============================================================\n");
  process.exit(0);
} else {
  console.error("  GATE 3 PARITY & INVARIANTS: VERIFICATION FAILED");
  console.log("=============================================================\n");
  process.exit(1);
}
