/**
 * @fileoverview Vitest Suite for S6-4 Agent Planner & proposeCostComparison.
 */

import { describe, it, expect } from "vitest";
import {
  planCostComparison,
  generatePlanSummary,
  executeProposeCostComparisonAction,
  ActionQueryRunner,
} from "../convex/agent/propose";
import { FakeModelProvider, VendorQuoteDraft } from "../convex/agent/model-provider";

describe("S6-4 Agent Planner & proposeCostComparison", () => {
  const poUser = {
    _id: "user_po",
    role: "procurement_officer" as const,
    isActive: true,
    name: "Priya PO",
    allowed: true,
    agentEnabled: true,
  };

  const supervisorUser = {
    _id: "user_sup_a1",
    role: "site_supervisor" as const,
    isActive: true,
    name: "Ravi Supervisor",
  };

  const validMR = {
    _id: "mr_ready",
    refNo: "MR-2026-0010",
    projectId: "proj_A",
    siteId: "site_A1",
    status: "ready_for_cc",
    items: [
      { itemName: "Cement 53 Grade", quantity: 100, unit: "bags" },
      { itemName: "Steel 12mm", quantity: 5, unit: "MT" },
    ],
  };

  const candidateVendors = [
    { _id: "v_1", name: "Alpha Traders", category: "materials", isActive: true },
    { _id: "v_2", name: "Beta Suppliers", category: "materials", isActive: true },
  ];

  const standardQuotes: VendorQuoteDraft[] = [
    {
      vendorId: "v_1",
      items: [
        { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350 },
        { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 60000 },
      ],
      taxRate: 18,
      freight: 500,
    },
    {
      vendorId: "v_2",
      items: [
        { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 360 },
        { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 59000 },
      ],
      taxRate: 18,
      freight: 400,
    },
  ];

  it("permits procurement_officer to plan cost comparison", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });
    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("proposed");
    expect(result.proposal?.vendorQuotes.length).toBe(2);
    expect(result.attemptCount).toBe(1);
    expect(result.validation?.ok).toBe(true);
  });

  it("refuses site_supervisor via RBAC gate", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });
    const result = await planCostComparison({
      caller: supervisorUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("Unauthorized");
    expect(result.attemptCount).toBe(0);
  });

  it("refuses MR not in ready_for_cc lifecycle status", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });
    const result = await planCostComparison({
      caller: poUser,
      rawMR: { ...validMR, status: "draft" },
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("ready_for_cc");
    expect(result.attemptCount).toBe(0);
  });

  it("refuses when fewer than 2 active vendors are available", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });
    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors: [candidateVendors[0]],
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("Uncertainty Refusal");
    expect(result.attemptCount).toBe(0);
  });

  it("executes self-correction retry loop when attempt 1 fails guardrails", async () => {
    const provider = new FakeModelProvider({
      customHandler: (_ctx, attempt) => {
        if (attempt === 1) {
          // Attempt 1: only 1 vendor quote (fails >= 2 rule)
          return { ok: true, vendorQuotes: [standardQuotes[0]] };
        }
        // Attempt 2: valid 2 quotes
        return { ok: true, vendorQuotes: standardQuotes };
      },
    });

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("proposed");
    expect(result.attemptCount).toBe(2);
    expect(result.proposal?.vendorQuotes.length).toBe(2);
  });

  it("exhausts after 3 attempts if model output continuously fails validation", async () => {
    const provider = new FakeModelProvider({
      defaultQuotes: [standardQuotes[0]], // only 1 quote always
    });

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
    });

    expect(result.status).toBe("incomplete");
    expect(result.attemptCount).toBe(3);
    expect(result.reason).toContain("exhausted");
  });

  it("generates markdown plan summary with table formatting", () => {
    const summary = generatePlanSummary({
      mr: validMR,
      proposal: { materialRequestId: "mr_ready", vendorQuotes: standardQuotes },
      itemRateHistory: [],
    });

    expect(summary).toContain("Cost Comparison Proposal Summary");
    expect(summary).toContain("Target Material Request");
    expect(summary).toContain("| Vendor ID | Line Items |");
    expect(summary).toContain("v_1");
    expect(summary).toContain("v_2");
  });

  it("executes executeProposeCostComparisonAction with ActionQueryRunner mock", async () => {
    let callCount = 0;
    const mockRunner: ActionQueryRunner = {
      runQuery: async (_q: unknown, args: Record<string, unknown>) => {
        callCount++;
        if (args && "table" in args && args.table === "material_request") {
          return validMR;
        }
        if (args && "query" in args) {
          return [{ vendor: candidateVendors[0] }, { vendor: candidateVendors[1] }];
        }
        if (args && "itemName" in args) {
          return [];
        }
        if (callCount === 1) {
          // 1st query is checkAgentSafety
          return { allowed: true, agentEnabled: true };
        }
        // validateCallerScope
        return poUser;
      },
    };

    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });
    const result = await executeProposeCostComparisonAction(
      mockRunner,
      { materialRequestId: "mr_ready", token: "tok_po" },
      provider
    );

    expect(result.status).toBe("proposed");
    expect(result.proposal?.vendorQuotes.length).toBe(2);
  });
});
