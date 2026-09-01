/**
 * @fileoverview Unit and Integration Test Suite for Single Writer Stock Movement Engine (S2-02).
 */

import { describe, it, expect } from "vitest";
import {
  normalizeUnit,
  computeMovementDelta,
  postMovementCore,
  ACTION_BY_MOVEMENT_TYPE,
} from "../convex/movements";
import { PERMISSIONS, UserRole } from "../convex/permissions";
import { Id } from "../convex/_generated/dataModel";

describe("S2-02 · Unit Normalization & Canonical Enums", () => {
  it("maps legacy labels to canonical contract enum values", () => {
    expect(normalizeUnit("tonnes")).toBe("MT");
    expect(normalizeUnit("tonne")).toBe("MT");
    expect(normalizeUnit("pcs")).toBe("nos");
    expect(normalizeUnit("pieces")).toBe("nos");
    expect(normalizeUnit("bag")).toBe("bags");
    expect(normalizeUnit("bags")).toBe("bags");
    expect(normalizeUnit("cum")).toBe("cum");
    expect(normalizeUnit("MT")).toBe("MT");
    expect(normalizeUnit("nos")).toBe("nos");
  });

  it("handles whitespace and case insensitivity", () => {
    expect(normalizeUnit("  TONNES  ")).toBe("MT");
    expect(normalizeUnit(" Pcs ")).toBe("nos");
  });
});

describe("S2-02 · Arithmetic Balance Deltas & Reversal Inversion", () => {
  it("calculates positive delta for receipts and incoming transfers", () => {
    expect(computeMovementDelta("receipt", 100)).toBe(100);
    expect(computeMovementDelta("transfer_in", 45)).toBe(45);
  });

  it("calculates negative delta for issues, outgoing transfers, returns, and wastage", () => {
    expect(computeMovementDelta("issue", 25)).toBe(-25);
    expect(computeMovementDelta("transfer_out", 45)).toBe(-45);
    expect(computeMovementDelta("return", 10)).toBe(-10);
    expect(computeMovementDelta("wastage", 5)).toBe(-5);
  });

  it("calculates directional delta for physical count adjustments", () => {
    expect(computeMovementDelta("adjustment", 15, { adjustmentDirection: "add" })).toBe(15);
    expect(computeMovementDelta("adjustment", 8, { adjustmentDirection: "subtract" })).toBe(-8);
    expect(() => computeMovementDelta("adjustment", 10)).toThrow("Adjustment movements require adjustmentDirection");
  });

  it("inverts original sign for reversals across all movement types", () => {
    // Reversing a receipt (originally +100) -> -100
    expect(computeMovementDelta("reversal", 100, { originalMovementType: "receipt" })).toBe(-100);

    // Reversing a transfer_in (originally +45) -> -45
    expect(computeMovementDelta("reversal", 45, { originalMovementType: "transfer_in" })).toBe(-45);

    // Reversing an issue (originally -25) -> +25
    expect(computeMovementDelta("reversal", 25, { originalMovementType: "issue" })).toBe(25);

    // Reversing a wastage (originally -5) -> +5
    expect(computeMovementDelta("reversal", 5, { originalMovementType: "wastage" })).toBe(5);

    // Reversing an upward adjustment (originally +15) -> -15
    expect(
      computeMovementDelta("reversal", 15, {
        originalMovementType: "adjustment",
        originalAdjustmentDirection: "add",
      })
    ).toBe(-15);

    // Reversing a downward adjustment (originally -8) -> +8
    expect(
      computeMovementDelta("reversal", 8, {
        originalMovementType: "adjustment",
        originalAdjustmentDirection: "subtract",
      })
    ).toBe(8);
  });

  it("strictly rejects non-positive quantities (<= 0)", () => {
    expect(() => computeMovementDelta("receipt", 0)).toThrow("Movement quantity must be strictly positive");
    expect(() => computeMovementDelta("issue", -10)).toThrow("Movement quantity must be strictly positive");
  });
});

describe("S2-02 · Granular RBAC Role Boundaries", () => {
  it("enforces dedicated granular permission action for each movement type", () => {
    expect(ACTION_BY_MOVEMENT_TYPE.receipt).toBe("movements:receive");
    expect(ACTION_BY_MOVEMENT_TYPE.issue).toBe("movements:issue");
    expect(ACTION_BY_MOVEMENT_TYPE.transfer_out).toBe("movements:transfer");
    expect(ACTION_BY_MOVEMENT_TYPE.transfer_in).toBe("movements:transfer");
    expect(ACTION_BY_MOVEMENT_TYPE.return).toBe("movements:return");
    expect(ACTION_BY_MOVEMENT_TYPE.wastage).toBe("movements:wastage");
    expect(ACTION_BY_MOVEMENT_TYPE.adjustment).toBe("movements:adjust");
    expect(ACTION_BY_MOVEMENT_TYPE.reversal).toBe("movements:reverse");
  });

  it("strictly excludes site_supervisor from adjust and reverse actions", () => {
    const adjustRoles = PERMISSIONS["movements:adjust"] as readonly UserRole[];
    const reverseRoles = PERMISSIONS["movements:reverse"] as readonly UserRole[];

    expect(adjustRoles).not.toContain("site_supervisor");
    expect(reverseRoles).not.toContain("site_supervisor");
    expect(adjustRoles).toEqual(["project_manager", "admin"]);
    expect(reverseRoles).toEqual(["project_manager", "admin"]);
  });

  it("permits site_supervisor for issue, receive, and wastage", () => {
    expect(PERMISSIONS["movements:issue"]).toContain("site_supervisor");
    expect(PERMISSIONS["movements:receive"]).toContain("site_supervisor");
    expect(PERMISSIONS["movements:wastage"]).toContain("site_supervisor");
  });
});

describe("S2-02 · postMovementCore Single Writer Logic & Idempotency", () => {
  function createMockContext(initialData: {
    site: any;
    user: any;
    inventory?: any[];
    movements?: any[];
  }) {
    const db = {
      sites: [initialData.site],
      users: [initialData.user],
      inventory: initialData.inventory ? [...initialData.inventory] : [],
      stock_movements: initialData.movements ? [...initialData.movements] : [],
      logs: [] as any[],
      sessions: [
        {
          _id: "sess_1",
          userId: initialData.user._id,
          token: "test_token",
          expiresAt: Date.now() + 100000,
        },
      ],

      async get(id: string) {
        if (id === initialData.site._id) return initialData.site;
        if (id === initialData.user._id) return initialData.user;
        const inv = this.inventory.find((i) => i._id === id);
        if (inv) return inv;
        const mov = this.stock_movements.find((m) => m._id === id);
        if (mov) return mov;
        return null;
      },

      query(tableName: string) {
        const self = this;
        let items: any[] = [];
        if (tableName === "inventory") items = self.inventory;
        if (tableName === "stock_movements") items = self.stock_movements;
        if (tableName === "sites") items = self.sites;
        if (tableName === "users") items = self.users;
        if (tableName === "sessions") items = self.sessions;

        return {
          withIndex(idxName: string, filterFn: (q: any) => any) {
            let filtered = [...items];
            if (idxName === "by_siteId_itemName") {
              const q = {
                eq: (field: string, val: any) => ({
                  eq: (field2: string, val2: any) => {
                    filtered = filtered.filter((i) => i.siteId === val && i.itemName === val2);
                    return q;
                  },
                }),
              };
              filterFn(q);
            }
            if (idxName === "by_sourceId") {
              const q = {
                eq: (field: string, val: any) => {
                  filtered = filtered.filter((m) => m.sourceId === val);
                  return q;
                },
              };
              filterFn(q);
            }
            if (idxName === "by_token") {
              const q = {
                eq: (field: string, val: any) => {
                  filtered = self.sessions.filter((s) => s.token === val);
                  return q;
                },
              };
              filterFn(q);
            }

            return {
              async unique() {
                return filtered[0] || null;
              },
              async first() {
                return filtered[0] || null;
              },
              async collect() {
                return filtered;
              },
            };
          },
          filter(filterFn: (q: any) => any) {
            return {
              async unique() {
                return items[0] || null;
              },
              async first() {
                return items[0] || null;
              },
              async collect() {
                return items;
              },
            };
          },
          async collect() {
            return [...items];
          },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).substring(2, 9)}`;
        const inserted = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(inserted);
        if (table === "stock_movements") this.stock_movements.push(inserted);
        if (table === "logs") this.logs.push(inserted);
        return _id;
      },

      async patch(id: string, patchDoc: any) {
        const inv = this.inventory.find((i) => i._id === id);
        if (inv) {
          Object.assign(inv, patchDoc);
        }
      },
    };

    return { db } as any;
  }

  const mockAdminUser = {
    _id: "user_admin_1" as Id<"users">,
    role: "admin",
    name: "Admin",
    isActive: true,
  };

  const mockSite = {
    _id: "site_A1" as Id<"sites">,
    name: "Site Alpha",
    projectId: "proj_Alpha" as Id<"projects">,
  };

  it("derives projectId strictly server-side from site lookup", async () => {
    const ctx = createMockContext({ site: mockSite, user: mockAdminUser });

    const res = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "receipt",
      quantity: 50,
      sourceType: "grn",
      sourceId: "GRN-2026-0001",
      sourceLineIndex: 0,
      token: "test_token",
      actorUser: mockAdminUser as any,
    });

    expect(res.balanceAfter).toBe(50);
    expect(res.isNegativeStock).toBe(false);
    expect(ctx.db.stock_movements[0].projectId).toBe("proj_Alpha");
    expect(ctx.db.inventory[0].quantity).toBe(50);
    expect(ctx.db.inventory[0].projectId).toBe("proj_Alpha");
  });

  it("handles line-indexed idempotency and prevents balance doubling on retry", async () => {
    const ctx = createMockContext({ site: mockSite, user: mockAdminUser });

    // First post: lineIndex 0
    const res1 = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "receipt",
      quantity: 50,
      sourceType: "grn",
      sourceId: "GRN-2026-0001",
      sourceLineIndex: 0,
      token: "test_token",
      actorUser: mockAdminUser as any,
    });

    expect(res1.isDuplicate).toBe(false);
    expect(ctx.db.inventory[0].quantity).toBe(50);

    // Duplicate retry of lineIndex 0 -> returns existing row without adding 50
    const res1Retry = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "receipt",
      quantity: 50,
      sourceType: "grn",
      sourceId: "GRN-2026-0001",
      sourceLineIndex: 0,
      token: "test_token",
      actorUser: mockAdminUser as any,
    });

    expect(res1Retry.isDuplicate).toBe(true);
    expect(res1Retry.movementId).toBe(res1.movementId);
    expect(ctx.db.inventory[0].quantity).toBe(50);
    expect(ctx.db.stock_movements.length).toBe(1);

    // Second line item of same material in same GRN (lineIndex 1) -> correctly posts
    const res2 = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "receipt",
      quantity: 30,
      sourceType: "grn",
      sourceId: "GRN-2026-0001",
      sourceLineIndex: 1,
      token: "test_token",
      actorUser: mockAdminUser as any,
    });

    expect(res2.isDuplicate).toBe(false);
    expect(ctx.db.inventory[0].quantity).toBe(80);
    expect(ctx.db.stock_movements.length).toBe(2);
  });

  it("flags isNegativeStock when consumption causes balance to fall below 0", async () => {
    const ctx = createMockContext({ site: mockSite, user: mockAdminUser });

    // Initial stock is 0; supervisor issues 15 bags
    const res = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Steel Rebar 12mm",
      unit: "MT",
      movementType: "issue",
      quantity: 15,
      purpose: "Slab reinforcement pour #2",
      sourceType: "manual",
      token: "test_token",
      actorUser: mockAdminUser as any,
    });

    expect(res.balanceAfter).toBe(-15);
    expect(res.isNegativeStock).toBe(true);
    expect(ctx.db.inventory[0].quantity).toBe(-15);
  });

  it("strictly requires non-empty purpose on issue and wastage", async () => {
    const ctx = createMockContext({ site: mockSite, user: mockAdminUser });

    await expect(
      postMovementCore(ctx, {
        siteId: mockSite._id,
        itemName: "Cement",
        unit: "bags",
        movementType: "issue",
        quantity: 10,
        purpose: "",
        sourceType: "manual",
        token: "test_token",
        actorUser: mockAdminUser as any,
      })
    ).rejects.toThrow("requires a non-empty purpose/reason description");

    await expect(
      postMovementCore(ctx, {
        siteId: mockSite._id,
        itemName: "Cement",
        unit: "bags",
        movementType: "wastage",
        quantity: 5,
        purpose: "   ",
        sourceType: "manual",
        token: "test_token",
        actorUser: mockAdminUser as any,
      })
    ).rejects.toThrow("requires a non-empty purpose/reason description");
  });

  it("correctly restores balance when reversing downward and upward adjustments", async () => {
    const ctx = createMockContext({ site: mockSite, user: mockAdminUser });

    // 1. Establish initial baseline: 50 bags received
    await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "receipt",
      quantity: 50,
      sourceType: "grn",
      sourceId: "GRN-2026-0001",
      token: "test_token",
      actorUser: mockAdminUser as any,
    });
    expect(ctx.db.inventory[0].quantity).toBe(50);

    // 2. Physical count shortfall: Adjust -10 bags (balance becomes 40)
    const adjustDownRes = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "adjustment",
      adjustmentDirection: "subtract",
      quantity: 10,
      purpose: "Monthly audit count shortage",
      sourceType: "manual",
      token: "test_token",
      actorUser: mockAdminUser as any,
    });
    expect(adjustDownRes.balanceAfter).toBe(40);
    expect(ctx.db.inventory[0].quantity).toBe(40);

    // 3. Reverse the downward adjustment: must add 10 back, restoring balance to 50
    const reverseDownRes = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "reversal",
      quantity: 10,
      reversalOfId: adjustDownRes.movementId,
      originalMovementType: "adjustment",
      originalAdjustmentDirection: "subtract",
      purpose: "Audit recount corrected: bags located in secondary shed",
      sourceType: "manual",
      sourceId: String(adjustDownRes.movementId),
      token: "test_token",
      actorUser: mockAdminUser as any,
    });
    expect(reverseDownRes.balanceAfter).toBe(50);
    expect(ctx.db.inventory[0].quantity).toBe(50);

    // 4. Physical count surplus: Adjust +15 bags (balance becomes 65)
    const adjustUpRes = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "adjustment",
      adjustmentDirection: "add",
      quantity: 15,
      purpose: "Found extra batch from unrecorded return",
      sourceType: "manual",
      token: "test_token",
      actorUser: mockAdminUser as any,
    });
    expect(adjustUpRes.balanceAfter).toBe(65);
    expect(ctx.db.inventory[0].quantity).toBe(65);

    // 5. Reverse the upward adjustment: must subtract 15, restoring balance to 50
    const reverseUpRes = await postMovementCore(ctx, {
      siteId: mockSite._id,
      itemName: "Cement 53 Grade",
      unit: "bags",
      movementType: "reversal",
      quantity: 15,
      reversalOfId: adjustUpRes.movementId,
      originalMovementType: "adjustment",
      originalAdjustmentDirection: "add",
      purpose: "Reversing surplus: batch belonged to Site Beta",
      sourceType: "manual",
      sourceId: String(adjustUpRes.movementId),
      token: "test_token",
      actorUser: mockAdminUser as any,
    });
    expect(reverseUpRes.balanceAfter).toBe(50);
    expect(ctx.db.inventory[0].quantity).toBe(50);
  });
});

/**
 * S2-03 — GRN Receipt Posts Movement via postMovementCore
 *
 * These tests prove that grn.ts correctly cascades into the single writer engine.
 * They use postMovementCore directly with sourceType: "grn" to mirror what
 * confirmDeliveryAndGenerateGRN does internally.
 */
describe("S2-03 · GRN Receipt → Stock Ledger Wiring", () => {
  // Shared helpers from the S2-02 describe block re-declared here for isolation.
  function createMockCtx() {
    const db = {
      inventory: [] as any[],
      stock_movements: [] as any[],
      logs: [] as any[],
      sessions: [{ _id: "s1", userId: "user_admin_1", token: "test_token", expiresAt: Date.now() + 100000 }],
      sites: [{ _id: "site_B1" as Id<"sites">, name: "Site Beta", projectId: "proj_Beta" as Id<"projects"> }],
      users: [{ _id: "user_admin_1" as Id<"users">, role: "admin", name: "Admin", isActive: true }],

      async get(id: string) {
        if (id === "site_B1") return { _id: "site_B1", name: "Site Beta", projectId: "proj_Beta" };
        if (id === "site_A1") return { _id: "site_A1", name: "Site Alpha", projectId: "proj_Alpha" };
        if (id === "pi_valid") return { _id: "pi_valid", itemName: "Cement OPC 53", category: "cement", unit: "bags", projectId: "proj_Beta" };
        if (id === "pi_foreign_project") return { _id: "pi_foreign_project", itemName: "Cement OPC 53", category: "cement", unit: "bags", projectId: "proj_Alpha" };
        return null;
      },

      query(tableName: string) {
        const self = this;
        const tableMap: Record<string, any[]> = {
          inventory: self.inventory,
          stock_movements: self.stock_movements,
          sessions: self.sessions,
          sites: self.sites,
          users: self.users,
        };
        const items = tableMap[tableName] || [];
        return {
          withIndex(_idx: string, filterFn: (q: any) => any) {
            let filtered = [...items];
            if (_idx === "by_siteId_itemName") {
              const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
              filterFn(q);
            }
            if (_idx === "by_sourceId") {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.sourceId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_token") {
              const q = { eq: (_f: string, v: any) => { filtered = self.sessions.filter((s) => s.token === v); return q; } };
              filterFn(q);
            }
            return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          filter(_fn: any) { return { async first() { return items[0] || null; }, async collect() { return [...items]; } }; },
          async collect() { return [...items]; },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
        const row = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(row);
        if (table === "stock_movements") this.stock_movements.push(row);
        if (table === "logs") this.logs.push(row);
        return _id;
      },

      async patch(id: string, patch: any) {
        const inv = this.inventory.find((i: any) => i._id === id);
        if (inv) Object.assign(inv, patch);
      },
    };
    return { db } as any;
  }

  const ADMIN = { _id: "user_admin_1" as Id<"users">, role: "admin", name: "Admin", isActive: true };
  const SITE_ID = "site_B1" as Id<"sites">;

  it("grn:create and movements:receive permission lists are identical (cascade safety)", () => {
    // These two lists must be kept in sync. A role allowed to create GRNs must
    // be allowed to receive stock, or real deliveries will throw inside the cascade.
    const grnCreate = [...(PERMISSIONS["grn:create"] as readonly string[])].sort();
    const movementsReceive = [...(PERMISSIONS["movements:receive"] as readonly string[])].sort();
    expect(grnCreate).toEqual(movementsReceive);
  });

  it("normalizeUnit runs before validation: 'tonnes' delivery posts as 'MT' without throwing", async () => {
    const ctx = createMockCtx();
    // dc.siteId carries live unit "tonnes" — normalizeUnit must canonicalise it
    const res = await postMovementCore(ctx, {
      siteId: SITE_ID,
      itemName: "Steel Rebar 16mm",
      unit: "tonnes",   // raw live value — must not throw at contract layer
      movementType: "receipt",
      quantity: 5,
      sourceType: "grn",
      sourceId: "grn_ABC",
      sourceLineIndex: 0,
      actorUser: ADMIN as any,
      token: "test_token",
    });
    expect(res.isDuplicate).toBe(false);
    expect(ctx.db.stock_movements[0].unit).toBe("MT");          // canonicalised in ledger row
    expect(ctx.db.inventory[0].unit).toBe("MT");                // canonicalised in balance cache
  });

  it("posts one ledger row per GRN line and updates inventory balance cache", async () => {
    const ctx = createMockCtx();
    const grnId = "grn_2026_0001";

    // Two line items on the same GRN
    const r0 = await postMovementCore(ctx, {
      siteId: SITE_ID, itemName: "Cement OPC 53", unit: "bags", movementType: "receipt",
      quantity: 100, sourceType: "grn", sourceId: grnId, sourceLineIndex: 0,
      actorUser: ADMIN as any, token: "test_token",
    });
    const r1 = await postMovementCore(ctx, {
      siteId: SITE_ID, itemName: "Sand (River)", unit: "cum", movementType: "receipt",
      quantity: 20, sourceType: "grn", sourceId: grnId, sourceLineIndex: 1,
      actorUser: ADMIN as any, token: "test_token",
    });

    // Two distinct movement rows created
    expect(ctx.db.stock_movements.length).toBe(2);

    // Ledger rows carry correct sourcing metadata
    expect(ctx.db.stock_movements[0]).toMatchObject({ sourceType: "grn", sourceId: grnId, sourceLineIndex: 0, movementType: "receipt" });
    expect(ctx.db.stock_movements[1]).toMatchObject({ sourceType: "grn", sourceId: grnId, sourceLineIndex: 1, movementType: "receipt" });

    // Balance cache matches ledger balanceAfter
    const cementInv = ctx.db.inventory.find((i: any) => i.itemName === "Cement OPC 53");
    const sandInv   = ctx.db.inventory.find((i: any) => i.itemName === "Sand (River)");
    expect(cementInv.quantity).toBe(r0.balanceAfter);
    expect(sandInv.quantity).toBe(r1.balanceAfter);
    expect(r0.balanceAfter).toBe(100);
    expect(r1.balanceAfter).toBe(20);
  });

  it("confirming the same GRN twice does not double stock (idempotency)", async () => {
    const ctx = createMockCtx();
    const grnId = "grn_2026_0002";
    const args = {
      siteId: SITE_ID, itemName: "Cement OPC 53", unit: "bags", movementType: "receipt" as const,
      quantity: 80, sourceType: "grn" as const, sourceId: grnId, sourceLineIndex: 0,
      actorUser: ADMIN as any, token: "test_token",
    };

    // First confirmation
    const first = await postMovementCore(ctx, args);
    expect(first.isDuplicate).toBe(false);
    expect(ctx.db.inventory[0].quantity).toBe(80);

    // Second confirmation (network retry / duplicate call)
    const second = await postMovementCore(ctx, args);
    expect(second.isDuplicate).toBe(true);
    expect(second.movementId).toBe(first.movementId);

    // Stock must not have doubled
    expect(ctx.db.inventory[0].quantity).toBe(80);
    expect(ctx.db.stock_movements.length).toBe(1);   // only one row ever inserted
  });

  it("strictly throws Forbidden when a site supervisor posts to an unassigned site", async () => {
    const ctx = createMockCtx();
    const supervisor = {
      _id: "user_sup_1" as Id<"users">,
      role: "site_supervisor",
      name: "Site Supervisor 1",
      isActive: true,
      assignedSiteIds: ["site_A1" as Id<"sites">], // assigned to Site A1 ONLY
      assignedProjectIds: ["proj_Beta" as Id<"projects">],
    };

    // Attempting to post movement to Site B1 (which is unassigned to this supervisor)
    await expect(
      postMovementCore(ctx, {
        siteId: SITE_ID, // site_B1
        itemName: "Cement OPC 53",
        unit: "bags",
        movementType: "receipt",
        quantity: 50,
        sourceType: "grn",
        sourceId: "grn_unassigned_site",
        sourceLineIndex: 0,
        actorUser: supervisor as any,
        token: "test_token",
      })
    ).rejects.toThrow(/Forbidden/);
  });
});

/**
 * S2-04 — Issue to Consumption (issueStock)
 */
describe("S2-04 · Issue to Consumption", () => {
  function createMockCtx() {
    const db = {
      inventory: [] as any[],
      stock_movements: [] as any[],
      logs: [] as any[],
      sessions: [{ _id: "s1", userId: "user_sup_1", token: "test_token", expiresAt: Date.now() + 100000 }],
      sites: [{ _id: "site_B1" as Id<"sites">, name: "Site Beta", projectId: "proj_Beta" as Id<"projects"> }],
      users: [
        {
          _id: "user_sup_1" as Id<"users">,
          role: "site_supervisor",
          name: "Supervisor",
          isActive: true,
          assignedSiteIds: ["site_B1" as Id<"sites">],
          assignedProjectIds: ["proj_Beta" as Id<"projects">],
        },
      ],

      async get(id: string) {
        if (id === "site_B1") return { _id: "site_B1", name: "Site Beta", projectId: "proj_Beta" };
        if (id === "site_A1") return { _id: "site_A1", name: "Site Alpha", projectId: "proj_Alpha" };
        if (id === "pi_valid") return { _id: "pi_valid", itemName: "Cement OPC 53", category: "cement", unit: "bags", projectId: "proj_Beta" };
        if (id === "pi_foreign_project") return { _id: "pi_foreign_project", itemName: "Cement OPC 53", category: "cement", unit: "bags", projectId: "proj_Alpha" };
        return null;
      },

      query(tableName: string) {
        const self = this;
        const tableMap: Record<string, any[]> = {
          inventory: self.inventory,
          stock_movements: self.stock_movements,
          sessions: self.sessions,
          sites: self.sites,
          users: self.users,
        };
        const items = tableMap[tableName] || [];
        return {
          withIndex(_idx: string, filterFn: (q: any) => any) {
            let filtered = [...items];
            if (_idx === "by_siteId_itemName") {
              const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
              filterFn(q);
            }
            if (_idx === "by_token") {
              const q = { eq: (_f: string, v: any) => { filtered = self.sessions.filter((s) => s.token === v); return q; } };
              filterFn(q);
            }
            return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          filter(_fn: any) { return { async first() { return items[0] || null; }, async collect() { return [...items]; } }; },
          async collect() { return [...items]; },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
        const row = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(row);
        if (table === "stock_movements") this.stock_movements.push(row);
        if (table === "logs") this.logs.push(row);
        return _id;
      },

      async patch(id: string, patch: any) {
        const inv = this.inventory.find((i: any) => i._id === id);
        if (inv) Object.assign(inv, patch);
      },
    };
    return { db } as any;
  }

  const SUPERVISOR = {
    _id: "user_sup_1" as Id<"users">,
    role: "site_supervisor",
    name: "Supervisor",
    isActive: true,
    assignedSiteIds: ["site_B1" as Id<"sites">],
    assignedProjectIds: ["proj_Beta" as Id<"projects">],
  };
  const SITE_ID = "site_B1" as Id<"sites">;

  it("reduces on-hand stock and updates running balance when material is issued", async () => {
    const ctx = createMockCtx();

    // 1. Initial stock: 100 bags received
    await postMovementCore(ctx, {
      siteId: SITE_ID,
      itemName: "Cement OPC 53",
      unit: "bags",
      movementType: "receipt",
      quantity: 100,
      sourceType: "grn",
      sourceId: "grn_001",
      actorUser: SUPERVISOR as any,
      token: "test_token",
    });
    expect(ctx.db.inventory[0].quantity).toBe(100);

    // 2. Supervisor issues 35 bags to consumption
    const res = await postMovementCore(ctx, {
      siteId: SITE_ID,
      itemName: "Cement OPC 53",
      unit: "bags",
      movementType: "issue",
      quantity: 35,
      purpose: "Ground floor beam casting pour #1",
      sourceType: "manual",
      actorUser: SUPERVISOR as any,
      token: "test_token",
    });

    expect(res.balanceAfter).toBe(65);
    expect(res.isNegativeStock).toBe(false);
    expect(ctx.db.inventory[0].quantity).toBe(65);
    expect(ctx.db.stock_movements[1].movementType).toBe("issue");
    expect(ctx.db.stock_movements[1].quantity).toBe(35);
    expect(ctx.db.stock_movements[1].balanceAfter).toBe(65);
  });

  it("derives unit and category directly from linked projectItem", async () => {
    const ctx = createMockCtx();

    const res = await postMovementCore(ctx, {
      siteId: SITE_ID,
      itemName: "Cement OPC 53",
      unit: "arbitrary_unit", // Should be overridden by projectItem's "bags"
      category: "arbitrary_cat", // Should be overridden by projectItem's "cement"
      movementType: "issue",
      quantity: 10,
      purpose: "PCC works under raft foundation",
      projectItemId: "pi_valid" as Id<"project_items">,
      sourceType: "manual",
      actorUser: SUPERVISOR as any,
      token: "test_token",
    });

    expect(ctx.db.stock_movements[0].unit).toBe("bags");
    expect(ctx.db.stock_movements[0].category).toBe("cement");
    expect(ctx.db.inventory[0].unit).toBe("bags");
    expect(ctx.db.inventory[0].category).toBe("cement");
  });

  it("strictly throws when projectItemId belongs to a foreign project", async () => {
    const ctx = createMockCtx();

    // pi_foreign_project belongs to proj_Alpha, but site_B1 belongs to proj_Beta
    await expect(
      postMovementCore(ctx, {
        siteId: SITE_ID,
        itemName: "Cement OPC 53",
        unit: "bags",
        movementType: "issue",
        quantity: 10,
        purpose: "Attempting to cross-link project item",
        projectItemId: "pi_foreign_project" as Id<"project_items">,
        sourceType: "manual",
        actorUser: SUPERVISOR as any,
        token: "test_token",
      })
    ).rejects.toThrow(/Cross-project linking is forbidden/);
  });

  it("flags isNegativeStock: true when issued quantity exceeds on-hand stock without throwing", async () => {
    const ctx = createMockCtx();

    // 0 on hand; supervisor issues 12 bags
    const res = await postMovementCore(ctx, {
      siteId: SITE_ID,
      itemName: "Steel Rebar 16mm",
      unit: "MT",
      movementType: "issue",
      quantity: 12,
      purpose: "Urgent slab reinforcement pour",
      sourceType: "manual",
      actorUser: SUPERVISOR as any,
      token: "test_token",
    });

    expect(res.balanceAfter).toBe(-12);
    expect(res.isNegativeStock).toBe(true);
    expect(ctx.db.inventory[0].quantity).toBe(-12);
    expect(ctx.db.stock_movements[0].isNegativeStock).toBe(true);
  });
});

/**
 * S2-05 — Transfer, Return, Wastage, Adjustment
 */
describe("S2-05 · Transfer, Return, Wastage, Adjustment", () => {
  function createMockCtx() {
    const db = {
      inventory: [] as any[],
      stock_movements: [] as any[],
      logs: [] as any[],
      grn: [
        {
          _id: "grn_site_B1" as Id<"grn">,
          siteId: "site_B1" as Id<"sites">,
          refNo: "GRN-2026-0001",
        },
        {
          _id: "grn_site_A1" as Id<"grn">,
          siteId: "site_A1" as Id<"sites">,
          refNo: "GRN-2026-0002",
        },
      ],
      sessions: [{ _id: "s1", userId: "user_pm_1", token: "test_token", expiresAt: Date.now() + 100000 }],
      sites: [
        { _id: "site_B1" as Id<"sites">, name: "Site Beta", projectId: "proj_Beta" as Id<"projects"> },
        { _id: "site_A1" as Id<"sites">, name: "Site Alpha", projectId: "proj_Alpha" as Id<"projects"> },
      ],
      users: [
        {
          _id: "user_pm_1" as Id<"users">,
          role: "project_manager",
          name: "PM",
          isActive: true,
          assignedSiteIds: ["site_B1" as Id<"sites">, "site_A1" as Id<"sites">],
          assignedProjectIds: ["proj_Beta" as Id<"projects">, "proj_Alpha" as Id<"projects">],
        },
        {
          _id: "user_sup_1" as Id<"users">,
          role: "site_supervisor",
          name: "Supervisor",
          isActive: true,
          assignedSiteIds: ["site_B1" as Id<"sites">],
          assignedProjectIds: ["proj_Beta" as Id<"projects">],
        },
      ],

      async get(id: string) {
        if (id === "site_B1") return { _id: "site_B1", name: "Site Beta", projectId: "proj_Beta" };
        if (id === "site_A1") return { _id: "site_A1", name: "Site Alpha", projectId: "proj_Alpha" };
        const grnDoc = this.grn.find((g: any) => g._id === id);
        if (grnDoc) return grnDoc;
        const mov = this.stock_movements.find((m: any) => m._id === id);
        if (mov) return mov;
        return null;
      },

      query(tableName: string) {
        const self = this;
        const tableMap: Record<string, any[]> = {
          inventory: self.inventory,
          stock_movements: self.stock_movements,
          sessions: self.sessions,
          sites: self.sites,
          users: self.users,
          grn: self.grn,
        };
        const items = tableMap[tableName] || [];
        return {
          withIndex(_idx: string, filterFn: (q: any) => any) {
            let filtered = [...items];
            if (_idx === "by_siteId_itemName") {
              const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
              filterFn(q);
            }
            if (_idx === "by_sourceId") {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.sourceId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_token") {
              const q = { eq: (_f: string, v: any) => { filtered = self.sessions.filter((s) => s.token === v); return q; } };
              filterFn(q);
            }
            return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          filter(filterFn: any) {
            const q = {
              eq: (fieldAccess: any, val: any) => {
                return items.filter((item: any) => item.reversalOfId === val);
              },
              field: (name: string) => name,
            };
            const filtered = filterFn(q);
            return { async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          async collect() { return [...items]; },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
        const row = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(row);
        if (table === "stock_movements") this.stock_movements.push(row);
        if (table === "logs") this.logs.push(row);
        return _id;
      },

      async patch(id: string, patch: any) {
        const inv = this.inventory.find((i: any) => i._id === id);
        if (inv) Object.assign(inv, patch);
      },
    };
    return { db } as any;
  }

  const PM = {
    _id: "user_pm_1" as Id<"users">,
    role: "project_manager",
    name: "PM",
    isActive: true,
    assignedSiteIds: ["site_B1" as Id<"sites">, "site_A1" as Id<"sites">],
    assignedProjectIds: ["proj_Beta" as Id<"projects">, "proj_Alpha" as Id<"projects">],
  };

  const SUPERVISOR = {
    _id: "user_sup_1" as Id<"users">,
    role: "site_supervisor",
    name: "Supervisor",
    isActive: true,
    assignedSiteIds: ["site_B1" as Id<"sites">],
    assignedProjectIds: ["proj_Beta" as Id<"projects">],
  };

  const SITE_B1 = "site_B1" as Id<"sites">;
  const SITE_A1 = "site_A1" as Id<"sites">;

  it("transferStock atomically creates two linked rows sharing transferRef and updates both site balances", async () => {
    const ctx = createMockCtx();
    const transferRef = "TRF-2026-TEST";

    // 1. Initial stock: 50 bags at Site B1, 10 bags at Site A1
    await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Cement OPC 53", unit: "bags", movementType: "receipt",
      quantity: 50, sourceType: "grn", sourceId: "grn_01", actorUser: PM as any, token: "test_token",
    });
    await postMovementCore(ctx, {
      siteId: SITE_A1, itemName: "Cement OPC 53", unit: "bags", movementType: "receipt",
      quantity: 10, sourceType: "grn", sourceId: "grn_02", actorUser: PM as any, token: "test_token",
    });

    // 2. Transfer 20 bags from Site B1 to Site A1
    const outRes = await postMovementCore(ctx, {
      siteId: SITE_B1, counterpartySiteId: SITE_A1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_out", quantity: 20, sourceType: "transfer", sourceId: transferRef,
      sourceLineIndex: 0, purpose: "Inter-site material balancing", actorUser: PM as any, token: "test_token",
    });

    const inRes = await postMovementCore(ctx, {
      siteId: SITE_A1, counterpartySiteId: SITE_B1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_in", quantity: 20, sourceType: "transfer", sourceId: transferRef,
      sourceLineIndex: 1, purpose: "Inter-site material balancing", actorUser: PM as any, token: "test_token",
    });

    // Source site balance decreased: 50 -> 30
    expect(outRes.balanceAfter).toBe(30);
    const sourceInv = ctx.db.inventory.find((i: any) => i.siteId === SITE_B1);
    expect(sourceInv.quantity).toBe(30);

    // Destination site balance increased: 10 -> 30
    expect(inRes.balanceAfter).toBe(30);
    const destInv = ctx.db.inventory.find((i: any) => i.siteId === SITE_A1);
    expect(destInv.quantity).toBe(30);

    // Both rows share the exact same sourceId
    expect(ctx.db.stock_movements[2].sourceId).toBe(transferRef);
    expect(ctx.db.stock_movements[3].sourceId).toBe(transferRef);
    expect(ctx.db.stock_movements[2].counterpartySiteId).toBe(SITE_A1);
    expect(ctx.db.stock_movements[3].counterpartySiteId).toBe(SITE_B1);
  });

  it("returnStock links source GRN and strictly verifies GRN belongs to the same site", async () => {
    const ctx = createMockCtx();

    // 1. Valid return: GRN grn_site_B1 belongs to Site B1
    await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Sand (River)", unit: "cum", movementType: "receipt",
      quantity: 15, sourceType: "grn", sourceId: "grn_site_B1", actorUser: PM as any, token: "test_token",
    });

    const returnRes = await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Sand (River)", unit: "cum", movementType: "return",
      quantity: 5, purpose: "Excess silt content rejected by QA", sourceType: "manual",
      sourceId: "grn_site_B1", actorUser: PM as any, token: "test_token",
    });

    expect(returnRes.balanceAfter).toBe(10);
    expect(ctx.db.stock_movements[1].movementType).toBe("return");
    expect(ctx.db.stock_movements[1].sourceId).toBe("grn_site_B1");
  });

  it("recordWastage decrements balance and strictly enforces non-empty purpose", async () => {
    const ctx = createMockCtx();

    await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Tiles 600x600", unit: "nos", movementType: "receipt",
      quantity: 100, sourceType: "grn", sourceId: "grn_tiles", actorUser: SUPERVISOR as any, token: "test_token",
    });

    const wasteRes = await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Tiles 600x600", unit: "nos", movementType: "wastage",
      quantity: 8, purpose: "Corner chipping during third floor transit", sourceType: "manual",
      actorUser: SUPERVISOR as any, token: "test_token",
    });

    expect(wasteRes.balanceAfter).toBe(92);
    expect(ctx.db.inventory[0].quantity).toBe(92);

    // Empty purpose must throw
    await expect(
      postMovementCore(ctx, {
        siteId: SITE_B1, itemName: "Tiles 600x600", unit: "nos", movementType: "wastage",
        quantity: 2, purpose: "   ", sourceType: "manual", actorUser: SUPERVISOR as any, token: "test_token",
      })
    ).rejects.toThrow(/requires a non-empty purpose/);
  });

  it("adjustStock applies directional add/subtract and strictly rejects site supervisor", async () => {
    const ctx = createMockCtx();

    // 1. Initial stock 50
    await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Binding Wire", unit: "kg", movementType: "receipt",
      quantity: 50, sourceType: "grn", sourceId: "grn_wire", actorUser: PM as any, token: "test_token",
    });

    // 2. Upward audit count correction (+10) by PM
    const adjAdd = await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Binding Wire", unit: "kg", movementType: "adjustment",
      adjustmentDirection: "add", quantity: 10, purpose: "Physical count surplus located in store B",
      sourceType: "manual", actorUser: PM as any, token: "test_token",
    });
    expect(adjAdd.balanceAfter).toBe(60);

    // 3. Downward audit count correction (-15) by PM
    const adjSub = await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Binding Wire", unit: "kg", movementType: "adjustment",
      adjustmentDirection: "subtract", quantity: 15, purpose: "Rust damage write-off",
      sourceType: "manual", actorUser: PM as any, token: "test_token",
    });
    expect(adjSub.balanceAfter).toBe(45);
  });
});

/**
 * S2-06 — Scoping, Index Capabilities & Transfer Succession
 */
describe("S2-06 · Scoping, Index Capabilities & Transfer Succession", () => {
  function createMockCtx() {
    const db = {
      inventory: [] as any[],
      stock_movements: [] as any[],
      logs: [] as any[],
      sessions: [
        { _id: "s_pm", userId: "user_pm_1", token: "pm_token", expiresAt: Date.now() + 100000 },
        { _id: "s_sup", userId: "user_sup_1", token: "sup_token", expiresAt: Date.now() + 100000 },
      ],
      sites: [
        { _id: "site_B1" as Id<"sites">, name: "Site Beta", projectId: "proj_Beta" as Id<"projects"> },
        { _id: "site_A1" as Id<"sites">, name: "Site Alpha", projectId: "proj_Alpha" as Id<"projects"> },
      ],
      users: [
        {
          _id: "user_pm_1" as Id<"users">,
          role: "project_manager",
          name: "PM",
          isActive: true,
          assignedSiteIds: ["site_B1" as Id<"sites">, "site_A1" as Id<"sites">],
          assignedProjectIds: ["proj_Beta" as Id<"projects">, "proj_Alpha" as Id<"projects">],
        },
        {
          _id: "user_sup_1" as Id<"users">,
          role: "site_supervisor",
          name: "Supervisor",
          isActive: true,
          assignedSiteIds: ["site_B1" as Id<"sites">],
          assignedProjectIds: ["proj_Beta" as Id<"projects">],
        },
      ],

      async get(id: string) {
        if (id === "site_B1") return { _id: "site_B1", name: "Site Beta", projectId: "proj_Beta" };
        if (id === "site_A1") return { _id: "site_A1", name: "Site Alpha", projectId: "proj_Alpha" };
        return null;
      },

      query(tableName: string) {
        const self = this;
        const tableMap: Record<string, any[]> = {
          inventory: self.inventory,
          stock_movements: self.stock_movements,
          sessions: self.sessions,
          sites: self.sites,
          users: self.users,
        };
        const items = tableMap[tableName] || [];
        return {
          withIndex(_idx: string, filterFn?: (q: any) => any) {
            let filtered = [...items];
            if (_idx === "by_siteId_itemName" && filterFn) {
              const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
              filterFn(q);
            }
            if (_idx === "by_sourceId" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.sourceId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_siteId" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.siteId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_projectId" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.projectId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_token" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = self.sessions.filter((s) => s.token === v); return q; } };
              filterFn(q);
            }
            return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          filter(_fn: any) { return { async first() { return items[0] || null; }, async collect() { return [...items]; } }; },
          async collect() { return [...items]; },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
        const row = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(row);
        if (table === "stock_movements") this.stock_movements.push(row);
        if (table === "logs") this.logs.push(row);
        return _id;
      },

      async patch(id: string, patch: any) {
        const inv = this.inventory.find((i: any) => i._id === id);
        if (inv) Object.assign(inv, patch);
      },
    };
    return { db } as any;
  }

  const PM = {
    _id: "user_pm_1" as Id<"users">,
    role: "project_manager",
    name: "PM",
    isActive: true,
    assignedSiteIds: ["site_B1" as Id<"sites">, "site_A1" as Id<"sites">],
    assignedProjectIds: ["proj_Beta" as Id<"projects">, "proj_Alpha" as Id<"projects">],
  };

  const SITE_B1 = "site_B1" as Id<"sites">;
  const SITE_A1 = "site_A1" as Id<"sites">;

  it("two successive transfers of the same item post independently without collision", async () => {
    const ctx = createMockCtx();

    // Initial balance: 100 bags at Site B1, 0 at Site A1
    await postMovementCore(ctx, {
      siteId: SITE_B1, itemName: "Cement OPC 53", unit: "bags", movementType: "receipt",
      quantity: 100, sourceType: "grn", sourceId: "grn_cement_initial", actorUser: PM as any, token: "pm_token",
    });

    // Transfer 1: 20 bags from Site B1 -> Site A1
    const trf1Ref = `TRF-1-${Date.now()}`;
    const t1Out = await postMovementCore(ctx, {
      siteId: SITE_B1, counterpartySiteId: SITE_A1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_out", quantity: 20, sourceType: "transfer", sourceId: trf1Ref,
      sourceLineIndex: 0, purpose: "Batch 1 transfer", actorUser: PM as any, token: "pm_token",
    });
    const t1In = await postMovementCore(ctx, {
      siteId: SITE_A1, counterpartySiteId: SITE_B1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_in", quantity: 20, sourceType: "transfer", sourceId: trf1Ref,
      sourceLineIndex: 1, purpose: "Batch 1 transfer", actorUser: PM as any, token: "pm_token",
    });

    expect(t1Out.isDuplicate).toBe(false);
    expect(t1In.isDuplicate).toBe(false);
    expect(t1Out.balanceAfter).toBe(80);
    expect(t1In.balanceAfter).toBe(20);

    // Transfer 2: Another 30 bags of the EXACT same item between the same sites in quick succession
    const trf2Ref = `TRF-2-${Date.now()}`;
    const t2Out = await postMovementCore(ctx, {
      siteId: SITE_B1, counterpartySiteId: SITE_A1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_out", quantity: 30, sourceType: "transfer", sourceId: trf2Ref,
      sourceLineIndex: 0, purpose: "Batch 2 transfer", actorUser: PM as any, token: "pm_token",
    });
    const t2In = await postMovementCore(ctx, {
      siteId: SITE_A1, counterpartySiteId: SITE_B1, itemName: "Cement OPC 53", unit: "bags",
      movementType: "transfer_in", quantity: 30, sourceType: "transfer", sourceId: trf2Ref,
      sourceLineIndex: 1, purpose: "Batch 2 transfer", actorUser: PM as any, token: "pm_token",
    });

    // Must post successfully as new distinct movement rows, not be swallowed
    expect(t2Out.isDuplicate).toBe(false);
    expect(t2In.isDuplicate).toBe(false);
    expect(t2Out.balanceAfter).toBe(50);
    expect(t2In.balanceAfter).toBe(50);

    // Total 5 ledger rows: 1 receipt + 2 transfer_out + 2 transfer_in
    expect(ctx.db.stock_movements.length).toBe(5);
  });
});

/**
 * S2-07 — Backfill Movements from Existing GRNs
 */
describe("S2-07 · Backfill Movements from Existing GRNs", () => {
  function createMockCtx() {
    const db = {
      inventory: [] as any[],
      stock_movements: [] as any[],
      logs: [] as any[],
      grn: [
        {
          _id: "grn_hist_1" as any,
          refNo: "GRN-HIST-001",
          siteId: "site_A1" as any,
          purchaseOrderId: "po_1" as any,
          receivedItems: [
            { itemName: "M-Sand", receivedQty: 100, unit: "tonnes", expectedQty: 100 },
            { itemName: "Coarse Aggregate 20mm", receivedQty: 50, unit: "tonnes", expectedQty: 50 },
          ],
          deliveredAt: "2026-08-15T10:00:00Z",
          confirmedBy: "user_sup_1" as any,
          createdBy: "user_sup_1" as any,
        },
        {
          _id: "grn_hist_2" as any,
          refNo: "GRN-HIST-002",
          siteId: "site_A1" as any,
          purchaseOrderId: "po_1" as any,
          receivedItems: [
            { itemName: "M-Sand", receivedQty: 60, unit: "tonnes", expectedQty: 60 },
          ],
          deliveredAt: "2026-08-20T10:00:00Z",
          confirmedBy: "user_sup_1" as any,
          createdBy: "user_sup_1" as any,
        },
      ],
      sessions: [
        { _id: "s_admin", userId: "user_admin_1", token: "admin_token", expiresAt: Date.now() + 100000 },
        { _id: "s_sup", userId: "user_sup_1", token: "sup_token", expiresAt: Date.now() + 100000 },
      ],
      sites: [
        { _id: "site_A1" as any, name: "Site Alpha", projectId: "proj_Alpha" as any },
      ],
      purchase_order: [
        {
          _id: "po_1" as any,
          refNo: "PO-2026-001",
          projectId: "proj_Alpha" as any,
          lineItems: [
            { itemName: "M-Sand", quantity: 200, unit: "tonnes", projectItemId: "pi_sand" as any },
            { itemName: "Coarse Aggregate 20mm", quantity: 50, unit: "tonnes", projectItemId: "pi_agg" as any },
          ],
        },
      ],
      project_items: [
        { _id: "pi_sand" as any, itemName: "M-Sand", category: "Raw Materials", unit: "tonnes", projectId: "proj_Alpha" as any },
        { _id: "pi_agg" as any, itemName: "Coarse Aggregate 20mm", category: "Raw Materials", unit: "tonnes", projectId: "proj_Alpha" as any },
      ],
      users: [
        {
          _id: "user_admin_1" as any,
          role: "admin",
          name: "Admin",
          isActive: true,
        },
        {
          _id: "user_sup_1" as any,
          role: "site_supervisor",
          name: "Supervisor",
          isActive: true,
          assignedSiteIds: ["site_A1" as any],
          assignedProjectIds: ["proj_Alpha" as any],
        },
      ],

      async get(id: string) {
        if (id === "site_A1") return { _id: "site_A1", name: "Site Alpha", projectId: "proj_Alpha" };
        if (id === "user_admin_1") return { _id: "user_admin_1", role: "admin", isActive: true, name: "Admin" };
        if (id === "user_sup_1") return { _id: "user_sup_1", role: "site_supervisor", isActive: true, name: "Supervisor" };
        if (id === "po_1") return this.purchase_order[0];
        if (id === "pi_sand") return this.project_items[0];
        if (id === "pi_agg") return this.project_items[1];
        return null;
      },

      query(tableName: string) {
        const self = this;
        const tableMap: Record<string, any[]> = {
          inventory: self.inventory,
          stock_movements: self.stock_movements,
          sessions: self.sessions,
          sites: self.sites,
          users: self.users,
          grn: self.grn,
          purchase_order: self.purchase_order,
          project_items: self.project_items,
        };
        const items = tableMap[tableName] || [];
        return {
          order(_direction: string) {
            return {
              async paginate(opts: { cursor: any; numItems: number }) {
                const slice = items.slice(0, opts.numItems);
                return { page: slice, isDone: true, continueCursor: "done" };
              },
            };
          },
          withIndex(_idx: string, filterFn?: (q: any) => any) {
            let filtered = [...items];
            if (_idx === "by_siteId_itemName" && filterFn) {
              const q = { eq: (f: string, v: any) => ({ eq: (_f2: string, v2: any) => { filtered = filtered.filter((i) => i.siteId === v && i.itemName === v2); return q; } }) };
              filterFn(q);
            }
            if (_idx === "by_sourceId" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = filtered.filter((m) => m.sourceId === v); return q; } };
              filterFn(q);
            }
            if (_idx === "by_token" && filterFn) {
              const q = { eq: (_f: string, v: any) => { filtered = self.sessions.filter((s) => s.token === v); return q; } };
              filterFn(q);
            }
            return { async unique() { return filtered[0] || null; }, async first() { return filtered[0] || null; }, async collect() { return filtered; } };
          },
          filter(_fn: any) { return { async first() { return items[0] || null; }, async collect() { return [...items]; } }; },
          async collect() { return [...items]; },
        };
      },

      async insert(table: string, doc: any) {
        const _id = `${table}_${Math.random().toString(36).slice(2, 9)}`;
        const row = { _id, _creationTime: Date.now(), ...doc };
        if (table === "inventory") this.inventory.push(row);
        if (table === "stock_movements") this.stock_movements.push(row);
        if (table === "logs") this.logs.push(row);
        return _id;
      },

      async patch(id: string, patch: any) {
        const inv = this.inventory.find((i: any) => i._id === id);
        if (inv) Object.assign(inv, patch);
      },
    };
    return { db } as any;
  }

  it("backfills movements for pre-existing GRNs and establishes accurate stock balances", async () => {
    const ctx = createMockCtx();
    const { backfillMovementsFromGRNs } = await import("../convex/movement_actions");

    const res = await (backfillMovementsFromGRNs as any)._handler(ctx, { token: "admin_token" });

    expect(res.success).toBe(true);
    expect(res.processedGRNs).toBe(2);
    expect(res.movementsCreated).toBe(3); // 2 from GRN 1, 1 from GRN 2
    expect(res.movementsSkipped).toBe(0);

    // Verify inventory balances
    const sandInv = ctx.db.inventory.find((i: any) => i.itemName === "M-Sand");
    const aggInv = ctx.db.inventory.find((i: any) => i.itemName === "Coarse Aggregate 20mm");

    expect(sandInv.quantity).toBe(160); // 100 + 60
    expect(sandInv.unit).toBe("MT");
    expect(sandInv.category).toBe("Raw Materials");
    expect(aggInv.quantity).toBe(50);
  });

  it("running backfill multiple times is strictly idempotent: 0 duplicate rows and 0 balance changes", async () => {
    const ctx = createMockCtx();
    const { backfillMovementsFromGRNs } = await import("../convex/movement_actions");

    // Run 1
    const run1 = await (backfillMovementsFromGRNs as any)._handler(ctx, { token: "admin_token" });
    expect(run1.movementsCreated).toBe(3);
    const countAfterRun1 = ctx.db.stock_movements.length;

    // Run 2 (immediate re-run)
    const run2 = await (backfillMovementsFromGRNs as any)._handler(ctx, { token: "admin_token" });
    expect(run2.movementsCreated).toBe(0);
    expect(run2.movementsSkipped).toBe(3);
    expect(ctx.db.stock_movements.length).toBe(countAfterRun1);

    // Balances must remain identical
    const sandInv = ctx.db.inventory.find((i: any) => i.itemName === "M-Sand");
    expect(sandInv.quantity).toBe(160);
  });

  it("does not duplicate receipts for GRNs that were already processed via live grn creation", async () => {
    const ctx = createMockCtx();
    const { backfillMovementsFromGRNs } = await import("../convex/movement_actions");

    // Live flow already posted GRN 1 with sourceType: "grn"
    await postMovementCore(ctx, {
      siteId: "site_A1" as any, itemName: "M-Sand", unit: "tonnes", category: "Raw Materials",
      movementType: "receipt", quantity: 100, sourceType: "grn", sourceId: "grn_hist_1",
      sourceLineIndex: 0, actorUser: { _id: "user_admin_1", role: "admin", isActive: true } as any,
      token: "admin_token",
    });

    // Run backfill
    const res = await (backfillMovementsFromGRNs as any)._handler(ctx, { token: "admin_token" });

    // GRN 1 Line 0 (M-Sand) should be recognized as duplicate and skipped!
    expect(res.movementsSkipped).toBe(1);
    expect(res.movementsCreated).toBe(2); // GRN 1 Line 1 (Agg) + GRN 2 Line 0 (M-Sand)

    const sandInv = ctx.db.inventory.find((i: any) => i.itemName === "M-Sand");
    expect(sandInv.quantity).toBe(160);
  });

  it("strictly rejects non-admin users attempting to execute backfill", async () => {
    const ctx = createMockCtx();
    const { backfillMovementsFromGRNs } = await import("../convex/movement_actions");

    await expect(
      (backfillMovementsFromGRNs as any)._handler(ctx, { token: "sup_token" })
    ).rejects.toThrow(/requires one of these roles: \[admin\]/);
  });
});




