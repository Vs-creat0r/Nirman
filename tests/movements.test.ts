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

