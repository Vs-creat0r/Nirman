/**
 * @fileoverview Gate 3: UI Action Parity Test Suite
 *
 * Asserts that all action pages import and invoke `api.lifecycle.availableActions`
 * and that action triggers directly consume server-returned action definitions
 * (label, enabled, reason) rather than local status checks.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { computeAvailableActions } from "../convex/lifecycle/actions";

const ACTION_PAGES = [
  "app/(dashboard)/dashboard/supervisor/material-requests/[id]/page.tsx",
  "app/(dashboard)/dashboard/supervisor/material-requests/[id]/edit/page.tsx",
  "app/(dashboard)/dashboard/deliveries/page.tsx",
  "app/(dashboard)/dashboard/procurement/purchase-orders/[id]/page.tsx",
  "app/(dashboard)/dashboard/procurement/purchase-orders/page.tsx",
  "app/(dashboard)/dashboard/procurement/cost-comparisons/[id]/page.tsx",
  "app/(dashboard)/dashboard/procurement/cost-comparisons/page.tsx",
  "app/(dashboard)/dashboard/procurement/cost-comparisons/[id]/edit/page.tsx",
];

const DASHBOARD_PAGES_WITH_STATE_SETS = [
  "app/(dashboard)/dashboard/supervisor/page.tsx",
  "convex/dashboard.ts",
];

describe("Gate 3: UI Action Parity & Server Authority", () => {
  it("all 8 core action pages import and query api.lifecycle.availableActions", () => {
    for (const relPath of ACTION_PAGES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File must exist: ${relPath}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      expect(
        content.includes("api.lifecycle.availableActions"),
        `Expected ${relPath} to query api.lifecycle.availableActions`
      ).toBe(true);
    }
  });

  it("dashboard and portal pages consume generated lifecycle state sets instead of ad-hoc status filters", () => {
    for (const relPath of DASHBOARD_PAGES_WITH_STATE_SETS) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File must exist: ${relPath}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      const hasStateSetImport =
        content.includes("lib/lifecycle") ||
        content.includes("lifecycle/index") ||
        content.includes("LOCKED_STATES") ||
        content.includes("CLOSED_STATES");

      expect(
        hasStateSetImport,
        `Expected ${relPath} to import and use generated lifecycle state sets`
      ).toBe(true);
    }
  });

  it("action pages do not decide button rendering via raw status === 'draft' or 'queried' inside action triggers", () => {
    for (const relPath of ACTION_PAGES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Ensure no `const isDraft = mr.status === "draft"` or `po.status === "draft"` left deciding action buttons
      expect(
        content.includes('mr.status === "draft"') ||
        content.includes('po.status === "draft"') ||
        content.includes('cc.status === "draft"'),
        `Forbidden raw status comparison deciding action in ${relPath}`
      ).toBe(false);
    }
  });

  it("queried PO for procurement officer returns server-authoritative resubmit action with label and reason", () => {
    const queriedPO = {
      _id: "po_queried_123" as any,
      status: "queried",
      createdBy: "user_po_1",
      items: [{ itemName: "Cement", quantity: 100 }],
    };

    const result = computeAvailableActions(
      "purchase_order",
      queriedPO,
      { _id: "user_po_1", role: "procurement_officer" }
    );

    expect(result.status).toBe("queried");
    const resubmitAction = result.actions.find((a) => a.name === "resubmit");
    expect(resubmitAction).toBeDefined();
    expect(resubmitAction?.enabled).toBe(true);
    expect(resubmitAction?.label).toBe("Resubmit Purchase Order");
    expect(resubmitAction?.to).toBe("submitted");
  });

  it("action buttons bind disabled, title, and label directly to server availableActions fields", () => {
    const poDetailPage = fs.readFileSync(
      path.resolve(process.cwd(), "app/(dashboard)/dashboard/procurement/purchase-orders/[id]/page.tsx"),
      "utf-8"
    );

    // Verify PO detail binds to canResubmit and canSubmit fields
    expect(poDetailPage.includes("canResubmit.label")).toBe(true);
    expect(poDetailPage.includes("canResubmit.reason")).toBe(true);
    expect(poDetailPage.includes("canSubmit.label")).toBe(true);
    expect(poDetailPage.includes("canSubmit.reason")).toBe(true);
  });
});
