/**
 * @fileoverview CI Metric Ratchet
 *
 * Enforces "never make it worse" ceilings on four code quality counters.
 * Baselines updated at Stage 4 completion (Gate 3).
 *
 * To intentionally raise a baseline: update the number here, justify in
 * the commit message, and get explicit review. Do NOT raise it silently.
 *
 * Counter methodology (consistent across runs):
 *   - 500-line cap  : all .ts/.tsx/.mjs outside node_modules/_generated/.next/test dirs
 *   - any usages    : \bany\b occurrences in same set (includes test files intentionally)
 *   - hardcoded colors: files containing # hex, rgb(), rgba() outside theme CSS files
 *   - relative imports: files with from "../" patterns
 */

import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";

const BASELINES = {
  filesOver500Lines: 14,        // locked: PO detail collapsed from 716 -> 163 (14 files > 500 lines)
  anyUsages: 105,               // locked: 101 achieved (+4 headroom)
  filesWithHardcodedColors: 0,  // locked: 0 files with hardcoded status colors
  filesWithRelativeImports: 0,  // locked: 0 files with relative imports
  consoleCallsInConvex: 0,      // locked: 0 console calls in convex/
};

const SOURCE_ROOTS = ["app", "components", "convex", "lib", "hooks"];
const EXCLUDE = [
  "node_modules", ".next", ".convex", "convex/_generated",
  ".git", "nirman-setup", "convex-tutorial", "tests", "scripts",
];

function walkDir(roots, exts, exclude) {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const fp = join(dir, e.name);
      const normalized = fp.replace(/\\/g, "/");
      if (exclude.some((x) => normalized.includes(x))) continue;
      if (e.isDirectory()) walk(fp);
      else if (exts.includes(extname(e.name))) results.push(fp);
    }
  }
  for (const root of roots) {
    walk(root);
  }
  return results;
}

function countOver500() {
  return walkDir(SOURCE_ROOTS, [".ts", ".tsx", ".mjs"], EXCLUDE)
    .map(f => { try { return { file: f, lines: readFileSync(f, "utf8").split("\n").length }; } catch { return null; } })
    .filter(x => x && x.lines > 500);
}

function countAny() {
  let total = 0;
  const matches = [];
  for (const f of walkDir(SOURCE_ROOTS, [".ts", ".tsx"], EXCLUDE)) {
    try {
      const n = (readFileSync(f, "utf8").match(/\bany\b/g) || []).length;
      if (n) { total += n; matches.push({ file: f, count: n }); }
    } catch {}
  }
  return { total, matches };
}

// Matches hardcoded Tailwind palette colors (e.g. text-emerald-600, bg-slate-100) — excludes semantic theme tokens
const COLOR_RE = /(bg|text|border)-(emerald|amber|rose|slate|indigo|blue|red|green|yellow|gray|zinc)-[0-9]{2,3}/;
function countColors() {
  return walkDir(["app", "components"], [".tsx"], EXCLUDE)
    .filter(f => { try { return COLOR_RE.test(readFileSync(f, "utf8")); } catch { return false; } });
}

function countRelative() {
  return walkDir(SOURCE_ROOTS, [".ts", ".tsx"], EXCLUDE)
    .filter(f => { try { return /from ['"]\.\.\//. test(readFileSync(f, "utf8")); } catch { return false; } });
}

function countConvexConsoleCalls() {
  return walkDir(["convex"], [".ts"], EXCLUDE)
    .map(f => {
      try {
        const n = (readFileSync(f, "utf8").match(/\bconsole\.(log|warn|error|info|debug)\b/g) || []).length;
        return { file: f, count: n };
      } catch { return { file: f, count: 0 }; }
    })
    .filter(x => x.count > 0);
}

// --- Main ---
console.log("\n=================================================================");
console.log("  NIRMAN CI - Code Quality Metric Ratchet  (baseline: v1.6.0 / Gate 3)");
console.log("=================================================================\n");

let failed = false;

function check(label, count, baseline, details) {
  const ok = count <= baseline;
  console.log(`[${ok ? "OK  " : "FAIL"}] ${label}: ${count} (baseline <= ${baseline})`);
  if (!ok) {
    failed = true;
    details.slice(0, 5).forEach(d => console.log(`       ${d}`));
  }
}

const over500 = countOver500();
check(
  "Files over 500 lines       ",
  over500.length,
  BASELINES.filesOver500Lines,
  over500.sort((a, b) => b.lines - a.lines).map(x => `${x.file} (${x.lines} lines)`)
);

const { total: anyCount, matches: anyMatches } = countAny();
check(
  "TypeScript `any` usages    ",
  anyCount,
  BASELINES.anyUsages,
  anyMatches.sort((a, b) => b.count - a.count).map(x => `${x.file} (${x.count})`)
);

const colors = countColors();
check(
  "Files with hardcoded colors",
  colors.length,
  BASELINES.filesWithHardcodedColors,
  colors
);

const relative = countRelative();
check(
  "Files with relative imports ",
  relative.length,
  BASELINES.filesWithRelativeImports,
  relative
);

const convexConsole = countConvexConsoleCalls();
const totalConsole = convexConsole.reduce((sum, x) => sum + x.count, 0);
check(
  "Console calls in `convex/`  ",
  totalConsole,
  BASELINES.consoleCallsInConvex,
  convexConsole.map(x => `${x.file} (${x.count} calls)`)
);

console.log("\n=================================================================");
if (failed) {
  console.log("  RATCHET FAILED - one or more counters exceed the baseline.");
  console.log("  Fix the offending files, or raise the baseline with justification.\n");
  process.exit(1);
} else {
  console.log("  RATCHET PASSED - all counters within baselines.\n");
  process.exit(0);
}
