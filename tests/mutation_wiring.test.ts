import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Mutation Wiring Verification Suite.
 *
 * Asserts that each exported mutation in convex/*.ts actually enforces
 * its assigned action key via `requirePermission` or `transition({ action: ... })`.
 *
 * This bridges the static permission matrix to actual runtime call sites.
 */

const CONVEX_DIR = path.resolve(__dirname, "../convex");

const EXPECTED_MUTATION_WIRING: Record<string, Record<string, string>> = {
  "material_requests.ts": {
    createMR: "material_requests:create",
    submitMR: "material_requests:submit",
    approveMR: "material_requests:approve",
    rejectMR: "material_requests:reject",
    queryMR: "material_requests:query",
    resubmitMR: "material_requests:resubmit",
    deleteMR: "material_requests:delete",
  },
  "cost_comparisons.ts": {
    createCC: "cost_comparisons:create",
    submitCC: "cost_comparisons:submit",
    approveCC: "cost_comparisons:approve",
    rejectCC: "cost_comparisons:reject",
    queryCC: "cost_comparisons:query",
    resubmitCC: "cost_comparisons:resubmit",
    deleteCC: "cost_comparisons:delete",
  },
  "purchase_orders.ts": {
    createPOFromCC: "purchase_orders:create",
    submitPO: "purchase_orders:submit",
  },
  "purchase_order_approvals.ts": {
    approvePO: "purchase_orders:approve",
    rejectPO: "purchase_orders:reject",
    queryPO: "purchase_orders:query",
    resubmitPO: "purchase_orders:resubmit",
  },
  "purchase_order_closure.ts": {
    cancelPO: "purchase_orders:cancel",
    deletePO: "purchase_orders:delete",
  },
  "delivery_challans.ts": {
    createDC: "delivery_challans:create",
    cancelDC: "delivery_challans:cancel",
  },
  "grn.ts": {
    confirmDeliveryAndGenerateGRN: "grn:create",
  },
  "vendors.ts": {
    createVendor: "vendors:create",
    updateVendor: "vendors:update",
    deactivateVendor: "vendors:deactivate",
  },
  "tc_templates.ts": {
    createTCTemplate: "tc_templates:create",
    updateTCTemplate: "tc_templates:update",
    deleteTCTemplate: "tc_templates:delete",
  },
  "project_items.ts": {
    backfillProjectItemCounters: "project_items:backfill",
    createProjectItem: "project_items:create",
  },
  "company_settings.ts": {
    updateCompanyProfile: "settings:manage",
  },
  "files.ts": {
    generateUploadUrl: "files:upload",
  },
  "projects.ts": {
    createProject: "projects:manage",
    updateProject: "projects:manage",
  },
  "sites.ts": {
    createSite: "sites:manage",
    updateSite: "sites:manage",
  },
  "users.ts": {
    updateUserAssignments: "users:manage",
    updateUser: "users:manage",
    changeUserRole: "users:change_role",
  },
  "movements.ts": {
    issueStock: "movements:issue",
    reverseMovement: "movements:reverse",
  },
};

describe("Mutation Source Wiring", () => {
  for (const [filename, mutations] of Object.entries(EXPECTED_MUTATION_WIRING)) {
    describe(`convex/${filename}`, () => {
      const filePath = path.join(CONVEX_DIR, filename);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      for (const [mutationName, expectedAction] of Object.entries(mutations)) {
        it(`wires mutation ${mutationName} to action key "${expectedAction}"`, () => {
          // Extract the slice of code corresponding to this exported mutation
          const exportIndex = fileContent.indexOf(`export const ${mutationName}`);
          expect(
            exportIndex,
            `Expected "export const ${mutationName}" to exist in ${filename}`
          ).toBeGreaterThan(-1);

          // Find end of this mutation declaration (next export const or end of file)
          const nextExportIndex = fileContent.indexOf("export const ", exportIndex + 1);
          const mutationSlice =
            nextExportIndex !== -1
              ? fileContent.slice(exportIndex, nextExportIndex)
              : fileContent.slice(exportIndex);

          // Assert requirePermission or transition is called with the expected action
          const hasDirectPermission =
            mutationSlice.includes(`"${expectedAction}"`) ||
            mutationSlice.includes(`'${expectedAction}'`);

          expect(
            hasDirectPermission,
            `Mutation ${mutationName} in ${filename} must reference action key "${expectedAction}"`
          ).toBe(true);
        });
      }
    });
  }
});
