/**
 * @fileoverview Vitest Suite for S6-7: Safety Switches (Kill switch, Cost caps, and Graceful failure).
 *
 * Implements S6-7 verification:
 * 1. Runtime Kill switch (agentEnabled = false) shuts off AI proposing without redeploying.
 * 2. Daily User Cap (default 40) stops AI proposals once exhausted with typed refusal.
 * 3. Monthly Org Cap (default 1000) stops AI proposals once exhausted with typed refusal.
 * 4. Manual createCC is 100% unaffected by agent switches or caps (zero blast radius).
 * 5. Model timeout / API failure degrades gracefully to { status: "incomplete" } without throwing.
 * 6. Attribution integrity: manual createCC logs source: "manual", agent-assisted logs source: "agent-assisted".
 */

import { describe, it, expect } from "vitest";
import {
  planCostComparison,
  executeProposeCostComparisonAction,
  ActionQueryRunner,
} from "../convex/agent/propose";
import {
  checkAgentSafetyHelper,
  recordAgentUsageHelper,
  getCurrentDateStrings,
} from "../convex/agent/usage";
import { createCC } from "../convex/cost_comparisons";
import { FakeModelProvider, VendorQuoteDraft, ModelProvider } from "../convex/agent/model-provider";
import { Id } from "../convex/_generated/dataModel";
import { UserRole } from "../convex/permissions";
import { QueryCtx, MutationCtx } from "../convex/_generated/server";

describe("S6-7 Safety Switches & Cost Caps", () => {
  const poUser = {
    _id: "user_po" as Id<"users">,
    role: "procurement_officer" as UserRole,
    isActive: true,
    name: "Priya PO",
    username: "po",
    assignedProjectIds: ["proj_A" as Id<"projects">],
  };

  const validMR = {
    _id: "mr_ready_1" as Id<"material_request">,
    refNo: "MR-2026-0010",
    projectId: "proj_A" as Id<"projects">,
    siteId: "site_A1" as Id<"sites">,
    status: "ready_for_cc",
    items: [
      { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", projectItemId: "pi_1" as Id<"project_items"> },
      { itemName: "Steel 12mm", quantity: 5, unit: "MT", projectItemId: "pi_2" as Id<"project_items"> },
    ],
  };

  const candidateVendors = [
    { _id: "v_1" as Id<"vendors">, name: "Alpha Traders", category: "materials", isActive: true },
    { _id: "v_2" as Id<"vendors">, name: "Beta Suppliers", category: "materials", isActive: true },
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
      paymentTerms: "30_days",
    },
    {
      vendorId: "v_2",
      items: [
        { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 360 },
        { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 59000 },
      ],
      taxRate: 18,
      freight: 400,
      paymentTerms: "15_days",
    },
  ];

  function createMockMutationCtx() {
    const insertedDocs: Record<string, any[]> = {
      cost_comparison: [],
      logs: [],
    };
    const patchedDocs: Record<string, any> = {};

    const ctx = {
      db: {
        get: async (id: string) => {
          if (id === "mr_ready_1") return validMR;
          if (id === "user_po") return poUser;
          return null;
        },
        insert: async (table: string, value: any) => {
          const _id = `${table}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const doc = { _id, _creationTime: Date.now(), ...value };
          if (!insertedDocs[table]) insertedDocs[table] = [];
          insertedDocs[table].push(doc);
          return _id;
        },
        patch: async (id: string, patch: any) => {
          patchedDocs[id] = { ...(patchedDocs[id] || {}), ...patch };
        },
        query: (table: string) => {
          if (table === "sessions") {
            return {
              withIndex: (_name: string, cb: (q: { eq: (f: string, v: string) => void }) => void) => {
                let queriedToken: string | undefined;
                cb({ eq: (_field: string, val: string) => { queriedToken = val; } });
                const resolver = async () => {
                  if (queriedToken === "token_po") {
                    return {
                      _id: "session_po",
                      userId: poUser._id,
                      token: "token_po",
                      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
                    };
                  }
                  return null;
                };
                return { unique: resolver, first: resolver };
              },
            };
          }
          if (table === "sites") {
            return {
              withIndex: (_name: string, _cb: any) => ({
                collect: async () => [{ _id: "site_A1", projectId: "proj_A", name: "Site A-1" }],
              }),
            };
          }
          if (table === "cost_comparison") {
            return {
              collect: async () => insertedDocs.cost_comparison || [],
            };
          }
          if (table === "settings") {
            return {
              first: async () => ({
                agentEnabled: false,
                agentDailyUserCap: 0,
                agentMonthlyOrgCap: 0,
              }),
            };
          }
          return {
            collect: async () => [],
            first: async () => null,
            unique: async () => null,
          };
        },
      },
    };

    return { ctx: ctx as unknown as MutationCtx, insertedDocs, patchedDocs };
  }

  // ── 1. Kill Switch Tests ──────────────────────────────────────────────

  it("kill switch off (agentEnabled = false) refuses proposal with zero model calls", async () => {
    let modelCalled = false;
    const provider = new FakeModelProvider({
      defaultQuotes: standardQuotes,
      customHandler: () => {
        modelCalled = true;
        return { ok: true, vendorQuotes: standardQuotes };
      },
    });

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
      safetyConfig: { agentEnabled: false },
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("AI assistant is turned off");
    expect(result.attemptCount).toBe(0);
    expect(modelCalled).toBe(false);
  });

  it("checkAgentSafetyHelper returns allowed: false when agentEnabled is false in settings", async () => {
    const mockCtx = {
      db: {
        query: (table: string) => {
          if (table === "settings") {
            return {
              first: async () => ({
                agentEnabled: false,
                agentDailyUserCap: 40,
                agentMonthlyOrgCap: 1000,
              }),
            };
          }
          return { first: async () => null, collect: async () => [] };
        },
      },
    } as unknown as QueryCtx;

    const safety = await checkAgentSafetyHelper(mockCtx, { userId: "user_po" });
    expect(safety.allowed).toBe(false);
    expect(safety.agentEnabled).toBe(false);
    expect(safety.reason).toContain("AI assistant is turned off");
  });

  // ── 2. Daily User Cap Tests ───────────────────────────────────────────

  it("daily cap reached refuses proposal with typed refusal", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
      safetyConfig: { dailyCapExceeded: true },
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("Daily AI request limit reached");
    expect(result.attemptCount).toBe(0);
  });

  it("checkAgentSafetyHelper enforces daily cap limit", async () => {
    const { date: todayStr } = getCurrentDateStrings();

    const mockCtx = {
      db: {
        query: (table: string) => {
          if (table === "settings") {
            return {
              first: async () => ({
                agentEnabled: true,
                agentDailyUserCap: 5,
                agentMonthlyOrgCap: 1000,
              }),
            };
          }
          if (table === "agent_usage") {
            return {
              withIndex: (_name: string, _cb: any) => ({
                first: async () => ({
                  userId: "user_po",
                  date: todayStr,
                  requestCount: 5, // reached cap
                }),
                collect: async () => [],
              }),
            };
          }
          return { first: async () => null, collect: async () => [] };
        },
      },
    } as unknown as QueryCtx;

    const safety = await checkAgentSafetyHelper(mockCtx, { userId: "user_po" });
    expect(safety.allowed).toBe(false);
    expect(safety.dailyUsageCount).toBe(5);
    expect(safety.dailyCap).toBe(5);
    expect(safety.reason).toContain("Daily AI request limit reached");
  });

  // ── 3. Monthly Org Cap Tests ──────────────────────────────────────────

  it("monthly cap reached refuses proposal with typed refusal", async () => {
    const provider = new FakeModelProvider({ defaultQuotes: standardQuotes });

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: provider,
      safetyConfig: { monthlyCapExceeded: true },
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("Monthly organization AI request limit reached");
    expect(result.attemptCount).toBe(0);
  });

  it("checkAgentSafetyHelper enforces monthly organization ceiling across all users", async () => {
    const { month: monthStr } = getCurrentDateStrings();

    const mockCtx = {
      db: {
        query: (table: string) => {
          if (table === "settings") {
            return {
              first: async () => ({
                agentEnabled: true,
                agentDailyUserCap: 40,
                agentMonthlyOrgCap: 100,
              }),
            };
          }
          if (table === "agent_usage") {
            return {
              withIndex: (name: string, _cb: any) => {
                if (name === "by_userId_date") {
                  return {
                    first: async () => ({ userId: "user_po", requestCount: 2 }), // user is under daily cap
                  };
                }
                if (name === "by_month") {
                  return {
                    collect: async () => [
                      { userId: "user_po", month: monthStr, requestCount: 40 },
                      { userId: "user_other", month: monthStr, requestCount: 60 },
                    ], // sum = 100 -> reached org monthly cap
                  };
                }
                return { first: async () => null, collect: async () => [] };
              },
            };
          }
          return { first: async () => null, collect: async () => [] };
        },
      },
    } as unknown as QueryCtx;

    const safety = await checkAgentSafetyHelper(mockCtx, { userId: "user_po" });
    expect(safety.allowed).toBe(false);
    expect(safety.monthlyUsageCount).toBe(100);
    expect(safety.monthlyCap).toBe(100);
    expect(safety.reason).toContain("Monthly organization AI request limit reached");
  });

  // ── 4. Usage Recording Mutation Tests ─────────────────────────────────

  it("recordAgentUsageHelper inserts new record or increments existing count", async () => {
    let inserted: any = null;
    let patched: any = null;

    // Test first request -> insert
    const insertCtx = {
      db: {
        query: () => ({
          withIndex: () => ({
            first: async () => null,
          }),
        }),
        insert: async (table: string, data: any) => {
          inserted = { table, ...data };
          return "usage_1";
        },
        patch: async () => {},
      },
    } as unknown as MutationCtx;

    const res1 = await recordAgentUsageHelper(insertCtx, { userId: "user_po" as Id<"users"> });
    expect(res1.success).toBe(true);
    expect(res1.requestCount).toBe(1);
    expect(inserted.table).toBe("agent_usage");
    expect(inserted.requestCount).toBe(1);

    // Test second request -> patch
    const patchCtx = {
      db: {
        query: () => ({
          withIndex: () => ({
            first: async () => ({ _id: "usage_1", requestCount: 4 }),
          }),
        }),
        insert: async () => {},
        patch: async (id: string, data: any) => {
          patched = { id, ...data };
        },
      },
    } as unknown as MutationCtx;

    const res2 = await recordAgentUsageHelper(patchCtx, { userId: "user_po" as Id<"users"> });
    expect(res2.success).toBe(true);
    expect(res2.requestCount).toBe(5);
    expect(patched.requestCount).toBe(5);
  });

  // ── 5. Graceful Degradation on Model Timeout / Network Failure ────────

  it("model provider timeout or exception degrades to typed incomplete proposal without throwing", async () => {
    const errorProvider: ModelProvider = {
      draftCostComparison: async () => {
        throw new Error("503 Service Unavailable: Model request timed out after 30000ms");
      },
    };

    const result = await planCostComparison({
      caller: poUser,
      rawMR: validMR,
      candidateVendors,
      itemRateHistory: [],
      modelProvider: errorProvider,
    });

    expect(result.status).toBe("incomplete");
    expect(result.reason).toContain("timed out");
    expect(result.attemptCount).toBe(3); // 3 attempts made in self-correction loop
    expect(result.proposal).toBeUndefined();
  });

  // ── 6. Manual createCC Isolation (Zero Blast Radius) ──────────────────

  it("manual createCC is 100% unaffected when agent is disabled or caps exhausted", async () => {
    const { ctx, insertedDocs } = createMockMutationCtx();

    // Direct manual createCC execution without agentContext
    const ccId = await (createCC as any)._handler(ctx, {
      token: "token_po",
      materialRequestId: validMR._id,
      vendorQuotes: [
        {
          vendorId: "v_1" as Id<"vendors">,
          items: [
            { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350 },
            { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 60000 },
          ],
          taxRate: 18,
          freight: 500,
          paymentTerms: "30_days",
        },
        {
          vendorId: "v_2" as Id<"vendors">,
          items: [
            { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 360 },
            { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 59000 },
          ],
          taxRate: 18,
          freight: 400,
          paymentTerms: "15_days",
        },
      ],
    });

    expect(ccId).toBeDefined();
    expect(insertedDocs.cost_comparison.length).toBe(1);
    expect(insertedDocs.cost_comparison[0].status).toBe("draft");

    // Audit log should be recorded as manual
    expect(insertedDocs.logs.length).toBe(1);
    expect(insertedDocs.logs[0].source).toBe("manual");
    expect(insertedDocs.logs[0].agentContext).toBeUndefined();
  });

  it("agent-assisted createCC records source: 'agent-assisted' with full agentContext", async () => {
    const { ctx, insertedDocs } = createMockMutationCtx();

    const agentCtx = {
      promptHash: "hash_abc123",
      proposalId: "prop_xyz789",
      confidenceScore: 0.95,
      modelProvider: "fake-model",
      modelVersion: "1.0",
      reasoning: "Optimal vendor selection based on lowest combined landed cost.",
      rawProposalPayload: JSON.stringify({ quotes: standardQuotes }),
      validationWarnings: [],
      selfCorrectionRetries: 0,
      proposedAt: new Date().toISOString(),
    };

    await (createCC as any)._handler(ctx, {
      token: "token_po",
      materialRequestId: validMR._id,
      vendorQuotes: standardQuotes as any,
      agentContext: agentCtx,
    });

    expect(insertedDocs.logs.length).toBe(1);
    expect(insertedDocs.logs[0].source).toBe("agent-assisted");
    expect(insertedDocs.logs[0].agentContext).toBeDefined();
    expect(insertedDocs.logs[0].agentContext.proposalId).toBe("prop_xyz789");
    expect(insertedDocs.logs[0].note).toContain("AI-proposed, confirmed by");
  });
});
