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

  it("queried PO for procurement officer returns server-authoritative resubmit action with label and reason, without duplicate submit", () => {
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
    const submitAction = result.actions.find((a) => a.name === "submit");
    expect(resubmitAction).toBeDefined();
    expect(resubmitAction?.enabled).toBe(true);
    expect(resubmitAction?.label).toBe("Resubmit Purchase Order");
    expect(resubmitAction?.to).toBe("submitted");
    expect(submitAction).toBeUndefined();
  });

  it("queried Cost Comparison returns ONLY resubmit and NEVER duplicate submit", () => {
    const queriedCC = {
      _id: "cc_queried_123" as any,
      status: "queried",
      createdBy: "user_po_1",
      vendorQuotes: [
        { vendorId: "v_1", total: 1000 },
        { vendorId: "v_2", total: 1200 },
      ],
    };

    const result = computeAvailableActions(
      "cost_comparison",
      queriedCC,
      { _id: "user_po_1", role: "procurement_officer" }
    );

    expect(result.status).toBe("queried");
    const resubmitAction = result.actions.find((a) => a.name === "resubmit");
    const submitAction = result.actions.find((a) => a.name === "submit");
    expect(resubmitAction).toBeDefined();
    expect(resubmitAction?.enabled).toBe(true);
    expect(resubmitAction?.label).toBe("Resubmit for Review");
    expect(submitAction).toBeUndefined();
  });

  it("draft Cost Comparison returns ONLY submit and NEVER resubmit", () => {
    const draftCC = {
      _id: "cc_draft_123" as any,
      status: "draft",
      createdBy: "user_po_1",
      vendorQuotes: [
        { vendorId: "v_1", total: 1000 },
        { vendorId: "v_2", total: 1200 },
      ],
    };

    const result = computeAvailableActions(
      "cost_comparison",
      draftCC,
      { _id: "user_po_1", role: "procurement_officer" }
    );

    expect(result.status).toBe("draft");
    const submitAction = result.actions.find((a) => a.name === "submit");
    const resubmitAction = result.actions.find((a) => a.name === "resubmit");
    expect(submitAction).toBeDefined();
    expect(submitAction?.enabled).toBe(true);
    expect(submitAction?.label).toBe("Submit for Review");
    expect(resubmitAction).toBeUndefined();
  });

  it("queried Material Request returns ONLY resubmit and NEVER duplicate submit", () => {
    const queriedMR = {
      _id: "mr_queried_123" as any,
      status: "queried",
      createdBy: "user_sup_1",
      items: [{ itemName: "Cement", quantity: 50 }],
    };

    const result = computeAvailableActions(
      "material_request",
      queriedMR,
      { _id: "user_sup_1", role: "site_supervisor" }
    );

    expect(result.status).toBe("queried");
    const resubmitAction = result.actions.find((a) => a.name === "resubmit");
    const submitAction = result.actions.find((a) => a.name === "submit");
    expect(resubmitAction).toBeDefined();
    expect(resubmitAction?.enabled).toBe(true);
    expect(resubmitAction?.label).toBe("Resubmit Request");
    expect(submitAction).toBeUndefined();
  });

  it("draft Material Request returns ONLY submit and NEVER resubmit", () => {
    const draftMR = {
      _id: "mr_draft_123" as any,
      status: "draft",
      createdBy: "user_sup_1",
      items: [{ itemName: "Cement", quantity: 50 }],
    };

    const result = computeAvailableActions(
      "material_request",
      draftMR,
      { _id: "user_sup_1", role: "site_supervisor" }
    );

    expect(result.status).toBe("draft");
    const submitAction = result.actions.find((a) => a.name === "submit");
    const resubmitAction = result.actions.find((a) => a.name === "resubmit");
    expect(submitAction).toBeDefined();
    expect(submitAction?.enabled).toBe(true);
    expect(submitAction?.label).toBe("Submit Request");
    expect(resubmitAction).toBeUndefined();
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

  it("DocumentView filters out actions where caller lacks required role (e.g. supervisor viewing pending MR)", () => {
    const docViewContent = fs.readFileSync(
      path.resolve(process.cwd(), "components/document/document-view.tsx"),
      "utf-8"
    );

    expect(docViewContent.includes('action.reason?.startsWith("Requires role")')).toBe(true);
  });
});
