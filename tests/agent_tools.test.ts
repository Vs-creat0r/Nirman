/**
 * @fileoverview Vitest Suite for S6-1 Read-Only Agent Tool Surface.
 */

import { describe, it, expect } from "vitest";
import {
  readDocumentHelper,
  listAvailableActionsHelper,
  explainStatusHelper,
  searchVendorsHelper,
  validateCallerScopeHelper,
} from "../convex/agent/tools";
import { QueryCtx } from "../convex/_generated/server";

describe("S6-1 Read-Only Agent Tool Surface", () => {
  const adminUser = {
    _id: "user_admin",
    role: "admin",
    isActive: true,
    name: "Admin User",
    username: "admin",
  };

  const supervisorSiteA1User = {
    _id: "user_sup_a1",
    role: "site_supervisor",
    isActive: true,
    name: "Ravi Supervisor",
    username: "sup_a1",
    assignedProjectIds: ["proj_A"],
    assignedSiteIds: ["site_A1"],
  };

  const pmProjectAUser = {
    _id: "user_pm_a",
    role: "project_manager",
    isActive: true,
    name: "Anil PM",
    username: "pm_a",
    assignedProjectIds: ["proj_A"],
    assignedSiteIds: ["site_A1", "site_A2"],
  };

  const poUser = {
    _id: "user_po",
    role: "procurement_officer",
    isActive: true,
    name: "Priya PO",
    username: "po",
    assignedProjectIds: ["proj_A"],
  };

  const mockUsers: Record<string, Record<string, unknown>> = {
    token_admin: adminUser,
    token_sup_a1: supervisorSiteA1User,
    token_pm_a: pmProjectAUser,
    token_po: poUser,
  };

  const mockDocuments: Record<string, Record<string, unknown>> = {
    mr_site_a1: {
      _id: "mr_site_a1",
      refNo: "MR-2026-0001",
      projectId: "proj_A",
      siteId: "site_A1",
      status: "pending",
      createdBy: "user_sup_a1",
      items: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags" }],
    },
    mr_site_a2: {
      _id: "mr_site_a2",
      refNo: "MR-2026-0002",
      projectId: "proj_A",
      siteId: "site_A2",
      status: "draft",
      createdBy: "user_other",
      items: [{ itemName: "Steel 12mm", quantity: 10, unit: "MT" }],
    },
    cc_draft_single_quote: {
      _id: "cc_draft_single_quote",
      refNo: "CC-2026-0001",
      projectId: "proj_A",
      siteId: "site_A1",
      status: "draft",
      createdBy: "user_po",
      vendorQuotes: [{ vendorId: "v1", total: 1000 }],
    },
    cc_draft_ready: {
      _id: "cc_draft_ready",
      refNo: "CC-2026-0002",
      projectId: "proj_A",
      siteId: "site_A1",
      status: "draft",
      createdBy: "user_po",
      vendorQuotes: [{ vendorId: "v1", total: 1000 }, { vendorId: "v2", total: 1200 }],
    },
  };

  const mockVendors = [
    {
      _id: "vendor_1",
      name: "Ultratech Cement Ltd",
      category: "cement",
      isActive: true,
      contactPerson: "Rajesh Kumar",
      address: "Mumbai Central",
    },
    {
      _id: "vendor_2",
      name: "Tata Steel Distributors",
      category: "steel",
      isActive: true,
      contactPerson: "Amit Shah",
      address: "Jamshedpur Yard",
    },
    {
      _id: "vendor_inactive",
      name: "Old Brick Works",
      category: "masonry",
      isActive: false,
    },
  ];

  function createMockCtx(): QueryCtx {
    return {
      db: {
        get: async (id: string) => {
          if (mockDocuments[id]) return mockDocuments[id];
          for (const user of Object.values(mockUsers)) {
            if (user._id === id) return user;
          }
          return null;
        },
        query: (table: string) => {
          if (table === "sessions") {
            return {
              withIndex: (_name: string, cb: (q: { eq: (f: string, v: string) => void }) => void) => {
                let queriedToken: string | undefined;
                cb({ eq: (_f: string, val: string) => { queriedToken = val; } });
                const resolver = async () => {
                  if (queriedToken && mockUsers[queriedToken]) {
                    return {
                      _id: `session_${queriedToken}`,
                      userId: mockUsers[queriedToken]._id,
                      token: queriedToken,
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
              withIndex: (_name: string, cb: (q: { eq: (f: string, v: string) => void }) => void) => {
                let queriedProjectId: string | undefined;
                cb({ eq: (_f: string, val: string) => { queriedProjectId = val; } });
                return {
                  collect: async () => [
                    { _id: "site_A1", projectId: "proj_A" },
                    { _id: "site_A2", projectId: "proj_A" },
                  ].filter((s) => s.projectId === queriedProjectId),
                };
              },
            };
          }
          if (table === "vendors") {
            return {
              collect: async () => mockVendors,
            };
          }
          return {
            collect: async () => [],
            first: async () => null,
          };
        },
      },
    } as unknown as QueryCtx;
  }

  it("reads scoped document when caller has access", async () => {
    const ctx = createMockCtx();
    const doc = await readDocumentHelper(ctx, {
      table: "material_request",
      id: "mr_site_a1",
      token: "token_sup_a1",
    });

    expect(doc).toBeDefined();
    expect(doc.refNo).toBe("MR-2026-0001");
  });

  it("throws permission/scoping error when supervisor tries to access out-of-site doc", async () => {
    const ctx = createMockCtx();
    await expect(
      readDocumentHelper(ctx, {
        table: "material_request",
        id: "mr_site_a2",
        token: "token_sup_a1",
      })
    ).rejects.toThrow();
  });

  it("lists available actions for project manager on pending material request", async () => {
    const ctx = createMockCtx();
    const result = await listAvailableActionsHelper(ctx, {
      table: "material_request",
      id: "mr_site_a1",
      token: "token_pm_a",
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("pending");
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it("explains draft CC status indicating quote count requirements", async () => {
    const ctx = createMockCtx();
    const explanationSingle = await explainStatusHelper(ctx, {
      table: "cost_comparison",
      id: "cc_draft_single_quote",
      token: "token_po",
    });

    expect(explanationSingle.status).toBe("draft");
    expect(explanationSingle.explanation).toContain("requires at least 2 vendor quotes");

    const explanationReady = await explainStatusHelper(ctx, {
      table: "cost_comparison",
      id: "cc_draft_ready",
      token: "token_po",
    });
    expect(explanationReady.explanation).toContain("ready to be submitted");
  });

  it("searches vendors with keyword ranking", async () => {
    const ctx = createMockCtx();
    const cementResults = await searchVendorsHelper(ctx, {
      query: "Ultratech Cement",
      token: "token_po",
    });

    expect(cementResults.length).toBeGreaterThan(0);
    expect(cementResults[0].vendor.name).toBe("Ultratech Cement Ltd");
    expect(cementResults[0].score).toBeGreaterThan(0);
  });

  it("validates caller scope and returns user identity", async () => {
    const ctx = createMockCtx();
    const profile = await validateCallerScopeHelper(ctx, { token: "token_po" });

    expect(profile.name).toBe("Priya PO");
    expect(profile.role).toBe("procurement_officer");
    expect(profile.isActive).toBe(true);
  });
});
