/**
 * @fileoverview S6-5 Human-Confirm → Real createCC Write + Agent-Attributed Audit Test Suite.
 *
 * Implements S6-5 T4:
 * 1. createCC with agentContext writes audit log with source: "agent-assisted", agentContext, and "AI-proposed, confirmed by [user]".
 * 2. createCC without agentContext writes audit log with source: "manual" (backward compatible).
 * 3. Confirmed proposal creates a draft CC (never submitted immediately).
 * 4. Server-side quote processing and math re-derivation remains authoritative over agent proposal values.
 * 5. Mutation-level RBAC is authoritative: unauthorized roles are rejected even with valid proposal.
 * 6. Scoping is authoritative: out-of-scope parent MR is rejected.
 * 7. Static analysis: zero parallel agent write mutations exist; all writes flow through createCC.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createCC, processVendorQuotes } from "../convex/cost_comparisons";
import { Id } from "../convex/_generated/dataModel";
import { UserRole } from "../convex/permissions";

describe("S6-5 Human-Confirm → Real createCC Write & Agent Attribution", () => {
  // ── Mock Data Fixtures ──────────────────────────────────────────────

  interface MockUser {
    _id: Id<"users">;
    role: UserRole;
    isActive: boolean;
    name: string;
    username: string;
    assignedProjectIds: Id<"projects">[];
    assignedSiteIds?: Id<"sites">[];
  }

  const poUser: MockUser = {
    _id: "user_po" as Id<"users">,
    role: "procurement_officer",
    isActive: true,
    name: "Priya PO",
    username: "po",
    assignedProjectIds: ["proj_A" as Id<"projects">],
  };

  const pmUser: MockUser = {
    _id: "user_pm" as Id<"users">,
    role: "project_manager",
    isActive: true,
    name: "Anil PM",
    username: "pm",
    assignedProjectIds: ["proj_A" as Id<"projects">],
    assignedSiteIds: ["site_A1" as Id<"sites">],
  };

  const supUser: MockUser = {
    _id: "user_sup_a1" as Id<"users">,
    role: "site_supervisor",
    isActive: true,
    name: "Ravi Supervisor",
    username: "sup_a1",
    assignedProjectIds: ["proj_A" as Id<"projects">],
    assignedSiteIds: ["site_A1" as Id<"sites">],
  };

  const mockUsers: Record<string, MockUser> = {
    token_po: poUser,
    token_pm: pmUser,
    token_sup: supUser,
  };

  const mockMR = {
    _id: "mr_approved_1" as Id<"material_request">,
    refNo: "MR-2026-0088",
    projectId: "proj_A" as Id<"projects">,
    siteId: "site_A1" as Id<"sites">,
    status: "ready_for_cc",
    items: [
      { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", projectItemId: "pi_1" as Id<"project_items"> },
      { itemName: "Steel 12mm", quantity: 5, unit: "MT", projectItemId: "pi_2" as Id<"project_items"> },
    ],
  };

  const mockForeignMR = {
    _id: "mr_foreign_1" as Id<"material_request">,
    refNo: "MR-2026-0099",
    projectId: "proj_Foreign" as Id<"projects">,
    siteId: "site_Foreign" as Id<"sites">,
    status: "ready_for_cc",
    items: [{ itemName: "Bricks", quantity: 1000, unit: "nos" }],
  };

  const mockSites: Record<string, { _id: string; projectId: string; name: string }> = {
    site_A1: { _id: "site_A1", projectId: "proj_A", name: "Site A-1" },
  };

  const validVendorQuotes = [
    {
      vendorId: "v_alpha" as Id<"vendors">,
      items: [
        { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350 },
        { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 60000 },
      ],
      taxRate: 18,
      freight: 500,
      paymentTerms: "30_days",
    },
    {
      vendorId: "v_beta" as Id<"vendors">,
      items: [
        { itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 340 },
        { itemName: "Steel 12mm", quantity: 5, unit: "MT", rate: 61000 },
      ],
      taxRate: 18,
      freight: 800,
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
          if (id === "mr_approved_1") return mockMR;
          if (id === "mr_foreign_1") return mockForeignMR;
          for (const u of Object.values(mockUsers)) {
            if (u._id === id) return u;
          }
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
                cb({ eq: (_field: string, val: string) => { queriedProjectId = val; } });
                return {
                  collect: async () =>
                    Object.values(mockSites).filter((s) => s.projectId === queriedProjectId),
                };
              },
            };
          }
          if (table === "cost_comparison") {
            return {
              collect: async () => insertedDocs.cost_comparison || [],
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

    return { ctx, insertedDocs, patchedDocs };
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it("creates a draft CC and writes agent-attributed audit log when agentContext is provided", async () => {
    const { ctx, insertedDocs } = createMockMutationCtx();

    const agentContext = {
      proposalId: "prop_2026_0918_01",
      provider: "gemini",
      model: "gemini-2.5-flash",
      promptVersion: "s6-v1",
    };

    // Execute createCC mutation handler
    const result = await (createCC as any)._handler(ctx, {
      materialRequestId: mockMR._id,
      vendorQuotes: validVendorQuotes,
      agentContext,
      token: "token_po",
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe("draft");
    expect(result.refNo).toMatch(/^CC-\d{4}-\d{4}$/);

    // Verify Cost Comparison document
    const createdCC = insertedDocs.cost_comparison[0];
    expect(createdCC).toBeDefined();
    expect(createdCC.status).toBe("draft");
    expect(createdCC.materialRequestId).toBe(mockMR._id);
    expect(createdCC.createdBy).toBe(poUser._id);
    expect(createdCC.vendorQuotes).toHaveLength(2);

    // Verify Audit Log entry
    const auditLogs = insertedDocs.logs;
    expect(auditLogs).toHaveLength(1);

    const log = auditLogs[0];
    expect(log.actorId).toBe(poUser._id);
    expect(log.actorRole).toBe("procurement_officer");
    expect(log.action).toBe("create_cc_draft");
    expect(log.documentType).toBe("cost_comparison");
    expect(log.documentId).toBe(result.id);
    expect(log.toStatus).toBe("draft");

    // S6-5 T1 Attribution Requirements
    expect(log.source).toBe("agent-assisted");
    expect(log.agentContext).toEqual(agentContext);
    expect(log.note).toBe("AI-proposed, confirmed by Priya PO (MR MR-2026-0088 with 2 vendor quotes)");
  });

  it("writes standard manual audit log when agentContext is omitted (backward compatibility)", async () => {
    const { ctx, insertedDocs } = createMockMutationCtx();

    const result = await (createCC as any)._handler(ctx, {
      materialRequestId: mockMR._id,
      vendorQuotes: validVendorQuotes,
      token: "token_po",
    });

    expect(result.status).toBe("draft");

    const auditLogs = insertedDocs.logs;
    expect(auditLogs).toHaveLength(1);

    const log = auditLogs[0];
    expect(log.actorId).toBe(poUser._id);
    expect(log.source).toBe("manual");
    expect(log.agentContext).toBeUndefined();
    expect(log.note).toBe("Cost comparison created for MR-2026-0088 with 2 vendor quotes");
  });

  it("guarantees confirmed proposal is strictly written as a DRAFT without advancing parent MR", async () => {
    const { ctx, insertedDocs, patchedDocs } = createMockMutationCtx();

    const result = await (createCC as any)._handler(ctx, {
      materialRequestId: mockMR._id,
      vendorQuotes: validVendorQuotes,
      agentContext: { proposalId: "prop_xyz" },
      token: "token_po",
    });

    expect(result.status).toBe("draft");

    const createdCC = insertedDocs.cost_comparison[0];
    expect(createdCC.status).toBe("draft");

    // Parent MR must NOT have been patched / transitioned automatically
    expect(patchedDocs[mockMR._id]).toBeUndefined();
  });

  it("enforces server-side quote processing and math re-derivation regardless of client payload", () => {
    const processed = processVendorQuotes(validVendorQuotes, mockMR.items);

    expect(processed).toHaveLength(2);

    // Vendor Alpha:
    // Item 1: 100 * 350 = 35,000
    // Item 2: 5 * 60,000 = 300,000
    // Subtotal: 335,000; Tax 18% = 60,300; Freight = 500; Total = 395,800
    expect(processed[0].subtotal).toBe(335000);
    expect(processed[0].taxAmount).toBe(60300);
    expect(processed[0].freight).toBe(500);
    expect(processed[0].total).toBe(395800);
    expect(processed[0].items[0].projectItemId).toBe("pi_1");
    expect(processed[0].items[1].projectItemId).toBe("pi_2");

    // Vendor Beta:
    // Item 1: 100 * 340 = 34,000
    // Item 2: 5 * 61,000 = 305,000
    // Subtotal: 339,000; Tax 18% = 61,020; Freight = 800; Total = 400,820
    expect(processed[1].subtotal).toBe(339000);
    expect(processed[1].taxAmount).toBe(61020);
    expect(processed[1].freight).toBe(800);
    expect(processed[1].total).toBe(400820);
  });

  it("enforces server-side RBAC gate: site supervisor cannot create CC even with agentContext", async () => {
    const { ctx } = createMockMutationCtx();

    await expect(
      (createCC as any)._handler(ctx, {
        materialRequestId: mockMR._id,
        vendorQuotes: validVendorQuotes,
        agentContext: { proposalId: "prop_sup_hack" },
        token: "token_sup",
      })
    ).rejects.toThrowError(/requires one of these roles/);
  });

  it("enforces server-side document scoping: cannot create CC for foreign out-of-scope MR", async () => {
    const { ctx } = createMockMutationCtx();

    await expect(
      (createCC as any)._handler(ctx, {
        materialRequestId: mockForeignMR._id,
        vendorQuotes: validVendorQuotes,
        agentContext: { proposalId: "prop_foreign_test" },
        token: "token_po",
      })
    ).rejects.toThrowError(/Forbidden: You do not have access to document/);
  });

  it("asserts zero parallel agent-write mutations exist across convex/agent/ and convex/cost_comparisons.ts", () => {
    const agentFiles = ["propose.ts", "tools.ts", "retrieval.ts", "model_provider.ts", "guardrails.ts"];
    const agentDir = join(__dirname, "../convex/agent");

    for (const file of agentFiles) {
      const code = readFileSync(join(agentDir, file), "utf-8");

      // Verify no mutation declarations inside agent directory
      expect(code).not.toMatch(/\bmutation\s*\(/);
      expect(code).not.toMatch(/\binternalMutation\s*\(/);
      expect(code).not.toMatch(/\bdb\.insert\s*\(/);
      expect(code).not.toMatch(/\bdb\.patch\s*\(/);
      expect(code).not.toMatch(/\bdb\.replace\s*\(/);
      expect(code).not.toMatch(/\bdb\.delete\s*\(/);
    }

    // In cost_comparisons.ts, verify createCC is the only create mutation
    const ccCode = readFileSync(join(__dirname, "../convex/cost_comparisons.ts"), "utf-8");
    const mutationMatches = Array.from(ccCode.matchAll(/export\s+const\s+(\w+)\s*=\s*mutation\s*\(/g)).map((m) => m[1]);

    expect(mutationMatches).toEqual([
      "createCC",
      "updateCC",
      "submitCC",
      "approveCC",
      "rejectCC",
      "queryCC",
      "resubmitCC",
      "deleteCC",
    ]);
  });
});

