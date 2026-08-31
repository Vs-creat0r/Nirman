/**
 * @fileoverview CI Metric Ratchet
 *
 * Enforces "never make it worse" ceilings on four code quality counters.
 * Baselines were recorded at Stage 1 / Day 3 commit (695a832).
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

// --- BASELINES (do not raise without justification) ---
const BASELINES = {
  filesOver500Lines: 15,   // 15 at 695a832; 2 new files from Stage 1 (projects/page, users/page)
  anyUsages: 235,          // 235 at 695a832; test infra type assertions included
  filesWithHardcodedColors: 29, // 29 at 695a832 per reviewer grep (Tailwind inline classes)
  filesWithRelativeImports: 19, // 19 at 695a832
};

const EXCLUDE = [
  "node_modules", ".next", ".convex", "convex/_generated",
  ".git", "nirman-setup", "convex-tutorial",
];

function walkDir(dir, exts, exclude) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (exclude.some((x) => fp.replace(/\\/g, "/").includes(x))) continue;
    if (e.isDirectory()) results.push(...walkDir(fp, exts, exclude));
    else if (exts.includes(extname(e.name))) results.push(fp);
  }
  return results;
}

function countOver500() {
  return walkDir(".", [".ts", ".tsx", ".mjs"], EXCLUDE)
    .map(f => { try { return { file: f, lines: readFileSync(f, "utf8").split("\n").length }; } catch { return null; } })
    .filter(x => x && x.lines > 500);
}

function countAny() {
  let total = 0;
  const matches = [];
  for (const f of walkDir(".", [".ts", ".tsx"], EXCLUDE)) {
    try {
      const n = (readFileSync(f, "utf8").match(/\bany\b/g) || []).length;
      if (n) { total += n; matches.push({ file: f, count: n }); }
    } catch {}
  }
  return { total, matches };
}

// Matches inline hex / rgb() / rgba() — excludes hsl(var(...)) theme tokens
const COLOR_RE = /(#[0-9a-fA-F]{3,8}\b|(?<![a-z-])rgb\s*\(|(?<![a-z-])rgba\s*\()/;
function countColors() {
  const exclude = [...EXCLUDE, "styles/globals.css", "styles/themes.css"];
  return walkDir(".", [".ts", ".tsx", ".css"], exclude)
    .filter(f => { try { return COLOR_RE.test(readFileSync(f, "utf8")); } catch { return false; } });
}

function countRelative() {
  return walkDir(".", [".ts", ".tsx"], EXCLUDE)
    .filter(f => { try { return /from ['"]\.\.\//. test(readFileSync(f, "utf8")); } catch { return false; } });
}

// --- Main ---
console.log("\n=================================================================");
console.log("  NIRMAN CI - Code Quality Metric Ratchet  (baseline: 695a832)");
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

console.log("\n=================================================================");
if (failed) {
  console.log("  RATCHET FAILED - one or more counters exceed the baseline.");
  console.log("  Fix the offending files, or raise the baseline with justification.\n");
  process.exit(1);
} else {
  console.log("  RATCHET PASSED - all counters within baselines.\n");
  process.exit(0);
}
