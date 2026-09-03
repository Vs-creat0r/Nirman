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
  it("DocumentView shell and all core action pages query api.lifecycle.availableActions", () => {
    // Assert DocumentView shell directly queries availableActions
    const docViewPath = path.resolve(process.cwd(), "components/document/document-view.tsx");
    expect(fs.existsSync(docViewPath), "DocumentView must exist").toBe(true);
    const docViewContent = fs.readFileSync(docViewPath, "utf-8");
    expect(
      docViewContent.includes("api.lifecycle.availableActions"),
      "DocumentView must query api.lifecycle.availableActions"
    ).toBe(true);

    for (const relPath of ACTION_PAGES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File must exist: ${relPath}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      const queriesAvailableActions =
        content.includes("api.lifecycle.availableActions") ||
        content.includes("DocumentView");

      expect(
        queriesAvailableActions,
        `Expected ${relPath} to query api.lifecycle.availableActions or render DocumentView shell`
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
    const docViewContent = fs.readFileSync(
      path.resolve(process.cwd(), "components/document/document-view.tsx"),
      "utf-8"
    );

    // Verify DocumentView binds directly to action.label, action.reason, and !action.enabled
    expect(docViewContent.includes("action.label")).toBe(true);
    expect(docViewContent.includes("action.reason")).toBe(true);
    expect(docViewContent.includes("!action.enabled")).toBe(true);
  });
});
