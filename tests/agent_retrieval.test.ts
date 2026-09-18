import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  projectSafeFields,
  retrieveByDocumentNumberHelper,
  retrieveByProjectHelper,
  retrieveByItemHelper,
  retrieveByVendorHelper,
} from "../convex/agent/retrieval";
import { validateProposal } from "../convex/agent/guardrails";

describe("S6-3 Retrieval (Grounding) & Field Projection", () => {
  // ── Mock Data Fixtures ──────────────────────────────────────────────

  const adminUser = { _id: "user_admin", role: "admin", isActive: true, name: "Admin", username: "admin" };
  const supA1User = {
    _id: "user_sup_a1", role: "site_supervisor", isActive: true, name: "Supervisor",
    username: "sup_a1", assignedProjectIds: ["proj_A"], assignedSiteIds: ["site_A1"],
  };
  const pmAUser = {
    _id: "user_pm_a", role: "project_manager", isActive: true, name: "PM Anil",
    username: "pm_a", assignedProjectIds: ["proj_A"], assignedSiteIds: ["site_A1", "site_A2"],
  };

  const mockUsers: Record<string, Record<string, unknown>> = {
    token_admin: adminUser,
    token_sup_a1: supA1User,
    token_pm_a: pmAUser,
  };

  const mockVendors: Record<string, Record<string, unknown>> = {
    v_1: {
      _id: "v_1", name: "BuildCore Supplies Pvt Ltd", category: "materials",
      contactPerson: "Rakesh Shah", address: "Andheri East, Mumbai", phone: "9876543210",
      email: "rakesh@buildcore.com", gstNo: "27AABCU9603R1ZM", isActive: true,
    },
    v_2: {
      _id: "v_2", name: "SteelPro India", category: "steel",
      contactPerson: "Meena Patel", address: "Navi Mumbai", phone: "9876543211",
      email: "sales@steelpro.in", gstNo: "27AABCS1234R1ZN", isActive: true,
    },
  };

  const mockDocuments: Record<string, Record<string, unknown>> = {
    mr_1: {
      _id: "mr_1", refNo: "MR-2026-0001", projectId: "proj_A", siteId: "site_A1",
      status: "ready_for_cc", priority: "high", notes: "Urgent foundation pour",
      items: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags" }],
    },
    mr_foreign: {
      _id: "mr_foreign", refNo: "MR-2026-0002", projectId: "proj_A", siteId: "site_A2",
      status: "pending", priority: "normal", items: [{ itemName: "Steel 12mm", quantity: 10, unit: "MT" }],
    },
    cc_1: {
      _id: "cc_1", refNo: "CC-2026-0001", projectId: "proj_A", siteId: "site_A1",
      materialRequestId: "mr_1", status: "submitted",
      vendorQuotes: [
        {
          vendorId: "v_1",
          items: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350, amount: 35000 }],
          subtotal: 35000, taxRate: 18, taxAmount: 6300, total: 41300,
        },
        {
          vendorId: "v_2",
          items: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 340, amount: 34000 }],
          subtotal: 34000, taxRate: 18, taxAmount: 6120, total: 40120,
        },
      ],
    },
    po_1: {
      _id: "po_1", refNo: "PO-2026-0001", projectId: "proj_A", siteId: "site_A1",
      vendorId: "v_1", status: "approved", paymentTerms: "30_days", subtotal: 35000,
      taxRate: 18, taxAmount: 6300, totalAmount: 41300,
      lineItems: [{ itemName: "Cement 53 Grade", quantity: 100, unit: "bags", rate: 350, amount: 35000 }],
    },
    boq_item_1: {
      _id: "boq_1", projectId: "proj_A", itemName: "Cement 53 Grade", category: "cement",
      unit: "bags", boqQty: 5000, procuredQty: 100, estimatedRate: 360,
    },
  };

  function createMockCtx() {
    return {
      db: {
        normalizeId: (_table: string, id: string) => id,
        get: async (id: string) => {
          if (mockDocuments[id]) return mockDocuments[id];
          if (mockVendors[id]) return mockVendors[id];
          for (const user of Object.values(mockUsers)) {
            if (user._id === id) return user;
          }
          return null;
        },
        query: (table: string) => {
          if (table === "sessions") {
            return {
              withIndex: (_name: string, cb: (q: any) => any) => {
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
              withIndex: (_name: string, cb: (q: any) => any) => {
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
          // Tables with by_refNo index
          return {
            withIndex: (indexName: string, cb: (q: any) => any) => {
              if (indexName === "by_refNo") {
                let queriedRefNo: string | undefined;
                cb({ eq: (_f: string, val: string) => { queriedRefNo = val; } });
                const match = Object.values(mockDocuments).find(
                  (d) => d.refNo === queriedRefNo
                );
                return {
                  first: async () => match || null,
                  collect: async () => (match ? [match] : []),
                };
              }
              if (indexName === "by_projectId" || indexName === "by_projectId_status") {
                let queriedProjId: string | undefined;
                cb({ eq: (_f: string, val: string) => { queriedProjId = val; } });
                return {
                  collect: async () =>
                    Object.values(mockDocuments).filter(
                      (d) => d.projectId === queriedProjId
                    ),
                };
              }
              if (indexName === "by_siteId_status" || indexName === "by_siteId") {
                let queriedSiteId: string | undefined;
                cb({ eq: (_f: string, val: string) => { queriedSiteId = val; } });
                return {
                  collect: async () =>
                    Object.values(mockDocuments).filter(
                      (d) => d.siteId === queriedSiteId
                    ),
                };
              }
              return {
                collect: async () => [],
                first: async () => null,
              };
            },
            collect: async () => Object.values(mockDocuments),
          };
        },
      },
    } as any;
  }

  // ── T1: Field Projection Boundary Tests ──────────────────────────────

  describe("T1 · Field Projection Boundary (§11.5)", () => {
    it("strips contactPerson, phone, email, address, and GST from vendor records", () => {
      const rawVendor = {
        _id: "v_1",
        name: "BuildCore Supplies",
        category: "materials",
        contactPerson: "Rakesh Shah",
        phone: "+91 9876543210",
        email: "rakesh@buildcore.com",
        address: "123 Industrial Area",
        gstNo: "27AABCU9603R1ZM",
        bankDetails: { account: "123456789" },
        isActive: true,
      };

      const projected = projectSafeFields("vendors", rawVendor) as any;

      expect(projected._id).toBe("v_1");
      expect(projected.name).toBe("BuildCore Supplies");
      expect(projected.category).toBe("materials");
      expect(projected.isActive).toBe(true);

      // PII and commercial credentials strictly stripped
      expect(projected.contactPerson).toBeUndefined();
      expect(projected.phone).toBeUndefined();
      expect(projected.email).toBeUndefined();
      expect(projected.address).toBeUndefined();
      expect(projected.gstNo).toBeUndefined();
      expect(projected.bankDetails).toBeUndefined();
    });

    it("projects only safe business fields for purchase orders", () => {
      const rawPo = {
        _id: "po_100",
        refNo: "PO-2026-0099",
        status: "approved",
        projectId: "proj_A",
        siteId: "site_A1",
        vendorId: "v_1",
        subtotal: 50000,
        taxRate: 18,
        taxAmount: 9000,
        totalAmount: 59000,
        siteContactPerson: "Site Engineer",
        siteContactPhone: "9988776655",
        lineItems: [
          { itemName: "Cement", quantity: 100, unit: "bags", rate: 500, amount: 50000 },
        ],
      };

      const projected = projectSafeFields("purchase_order", rawPo) as any;

      expect(projected.refNo).toBe("PO-2026-0099");
      expect(projected.totalAmount).toBe(59000);
      expect(projected.lineItems[0].itemName).toBe("Cement");
      expect(projected.lineItems[0].rate).toBe(500);

      // Verify contact phones stripped
      expect(projected.siteContactPerson).toBeUndefined();
      expect(projected.siteContactPhone).toBeUndefined();
    });
  });

  // ── T2: Scoped Retrieval Tools Tests ─────────────────────────────────

  describe("T2 · Scoped Retrieval Tools", () => {
    it("retrieveByDocumentNumber resolves document for authorized site supervisor", async () => {
      const ctx = createMockCtx();
      const result = await retrieveByDocumentNumberHelper(ctx, {
        refNo: "MR-2026-0001",
        token: "token_sup_a1",
      });

      expect(result).not.toBeNull();
      expect(result?.table).toBe("material_request");
      expect(result?.document._id).toBe("mr_1");
      expect(result?.document.refNo).toBe("MR-2026-0001");
    });

    it("retrieveByDocumentNumber returns null for foreign-site document (fail-closed, no leak)", async () => {
      const ctx = createMockCtx();
      // Supervisor on site_A1 queries MR from site_A2
      const result = await retrieveByDocumentNumberHelper(ctx, {
        refNo: "MR-2026-0002",
        token: "token_sup_a1",
      });

      expect(result).toBeNull();
    });

    it("retrieveByDocumentNumber returns null for non-existent refNo", async () => {
      const ctx = createMockCtx();
      const result = await retrieveByDocumentNumberHelper(ctx, {
        refNo: "NON-EXISTENT-REF",
        token: "token_admin",
      });

      expect(result).toBeNull();
    });

    it("retrieveByProject returns empty array when caller has no access to project", async () => {
      const ctx = createMockCtx();
      const results = await retrieveByProjectHelper(ctx, {
        projectId: "proj_Foreign",
        token: "token_sup_a1",
      });

      expect(results).toEqual([]);
    });

    it("retrieveByProject returns scoped projected documents for authorized PM", async () => {
      const ctx = createMockCtx();
      const results = await retrieveByProjectHelper(ctx, {
        projectId: "proj_A",
        token: "token_pm_a",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.document._id !== undefined)).toBe(true);
    });

    it("retrieveByItem grounds rate and quantity suggestions across historical documents", async () => {
      const ctx = createMockCtx();
      const matches = await retrieveByItemHelper(ctx, {
        itemName: "Cement",
        token: "token_pm_a",
      });

      expect(matches.length).toBeGreaterThan(0);
      const boqMatch = matches.find((m) => m.table === "project_items");
      expect(boqMatch?.matchedItem.itemName).toBe("Cement 53 Grade");
      expect(boqMatch?.matchedItem.estimatedRate).toBe(360);

      const poMatch = matches.find((m) => m.table === "purchase_order");
      expect(poMatch?.matchedItem.rate).toBe(350);
    });

    it("retrieveByVendor returns safe vendor profile and associated scoped orders", async () => {
      const ctx = createMockCtx();
      const result = await retrieveByVendorHelper(ctx, {
        vendorId: "v_1",
        token: "token_pm_a",
      });

      expect(result.vendor).not.toBeNull();
      expect(result.vendor?.name).toBe("BuildCore Supplies Pvt Ltd");
      expect((result.vendor as any).phone).toBeUndefined(); // Projected safe

      expect(result.documents.length).toBeGreaterThan(0);
      const poDoc = result.documents.find((d) => d.table === "purchase_order");
      expect(poDoc?.document._id).toBe("po_1");
    });
  });

  // ── T3: Contract-Sourced Guardrails Parity Tests ─────────────────────

  describe("T3 · Contract-Sourced Guardrails Parity", () => {
    it("validates proposal using contract-sourced permissions and parent transition states", () => {
      const validProposal = {
        materialRequestId: "mr_1",
        vendorQuotes: [
          { vendorId: "v_1", items: [{ itemName: "Cement", quantity: 100, rate: 350 }], taxRate: 18 },
          { vendorId: "v_2", items: [{ itemName: "Cement", quantity: 100, rate: 340 }], taxRate: 18 },
        ],
      };

      // Procurement officer can create CC
      const poResult = validateProposal(validProposal, {
        table: "cost_comparison",
        caller: { _id: "user_po", role: "procurement_officer" },
        parentDoc: { _id: "mr_1", status: "ready_for_cc" },
      });
      expect(poResult.ok).toBe(true);

      // Site supervisor rejected via contract permissions
      const supResult = validateProposal(validProposal, {
        table: "cost_comparison",
        caller: { _id: "user_sup", role: "site_supervisor" },
        parentDoc: { _id: "mr_1", status: "ready_for_cc" },
      });
      expect(supResult.ok).toBe(false);
      expect(supResult.errors[0]).toContain('Role "site_supervisor" is not authorized to create Cost Comparisons');

      // Parent MR in approved status rejected
      const badStatusResult = validateProposal(validProposal, {
        table: "cost_comparison",
        caller: { _id: "user_po", role: "procurement_officer" },
        parentDoc: { _id: "mr_1", status: "approved" },
      });
      expect(badStatusResult.ok).toBe(false);
      expect(badStatusResult.errors[0]).toContain('Parent Material Request is in "approved" status');
    });
  });

  // ── T5: Zero-Write Code Invariant ────────────────────────────────────

  describe("T5 · Zero-Write Code Invariant", () => {
    it("asserts convex/agent/retrieval.ts has zero mutations, writes, or external @/ imports", () => {
      const filePath = join(__dirname, "../convex/agent/retrieval.ts");
      const code = readFileSync(filePath, "utf-8");

      expect(code).not.toMatch(/\bmutation\s*\(/);
      expect(code).not.toMatch(/\binternalMutation\s*\(/);
      expect(code).not.toMatch(/\bdb\.insert\s*\(/);
      expect(code).not.toMatch(/\bdb\.patch\s*\(/);
      expect(code).not.toMatch(/\bdb\.replace\s*\(/);
      expect(code).not.toMatch(/\bdb\.delete\s*\(/);
      expect(code).not.toMatch(/from\s+["']@\//);

      const lineCount = code.split("\n").length;
      expect(lineCount).toBeLessThan(500);
    });
  });
});

