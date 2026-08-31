import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Strict allowlist of queries that are explicitly global master data or self-profile reads.
 * Any other query in convex/*.ts MUST call resolveCallerScope or requirePermission.
 */
const ALLOWED_GLOBAL_QUERIES = new Set([
  "company_settings.ts:getCompanyProfile",
  "projects.ts:listAllProjects",
  "sites.ts:listAllSites",
  "tc_templates.ts:listTCTemplates",
  "tc_templates.ts:getDefaultTCTemplate",
  "users.ts:getMyUser",
  "users.ts:list",
  "vendors.ts:listVendors",
  "vendors.ts:getVendor",
]);

describe("Query Scoping & Authorization Coverage", () => {
  const convexDir = path.resolve(__dirname, "../convex");
  const files = fs.readdirSync(convexDir).filter((f) => f.endsWith(".ts") && !f.startsWith("_"));

  const allFoundQueries: { file: string; queryName: string; source: string }[] = [];

  for (const file of files) {
    const filePath = path.join(convexDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Match all exported queries
    const queryRegex = /export\s+const\s+(\w+)\s*=\s*query\(\{([\s\S]*?)\n\}\);/g;
    let match;

    while ((match = queryRegex.exec(content)) !== null) {
      allFoundQueries.push({
        file,
        queryName: match[1],
        source: match[2],
      });
    }
  }

  it("finds all exported queries in convex backend", () => {
    expect(allFoundQueries.length).toBeGreaterThanOrEqual(25);
  });

  for (const { file, queryName, source } of allFoundQueries) {
    const key = `${file}:${queryName}`;

    it(`asserts query ${key} is scoped via resolveCallerScope or explicitly allowlisted`, () => {
      if (ALLOWED_GLOBAL_QUERIES.has(key)) {
        // Explicitly allowlisted global query
        expect(ALLOWED_GLOBAL_QUERIES.has(key)).toBe(true);
      } else {
        // Must enforce scoping / permissions
        const hasScopeCall =
          source.includes("resolveCallerScope") || source.includes("requirePermission");
        expect(
          hasScopeCall,
          `Query ${key} is not scoped! It must call resolveCallerScope(ctx, ...) or requirePermission(ctx, ...)`
        ).toBe(true);
      }
    });
  }
});
