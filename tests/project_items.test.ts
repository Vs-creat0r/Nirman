import { describe, it, expect } from "vitest";
import {
  getProjectBOQDetails,
  createProjectItem,
  updateProjectItem,
  deleteProjectItem,
  bulkImportProjectItems,
} from "../convex/project_items";
import { createMR } from "../convex/material_requests";

function createMockContext(data: {
  project?: any;
  site?: any;
  user?: any;
  projectItems?: any[];
  movements?: any[];
  sessions?: any[];
}) {
  const db = {
    projects: data.project ? [data.project] : [{ _id: "proj_1", name: "Alpha Towers", code: "PRJ-01", isActive: true }],
    sites: data.site ? [data.site] : [{ _id: "site_1", projectId: "proj_1", name: "Tower 1", code: "S1", isActive: true }],
    users: data.user
      ? [{ isActive: true, ...data.user }]
      : [{ _id: "user_admin", role: "admin", name: "Admin", username: "admin", isActive: true }],
    project_items: data.projectItems ? [...data.projectItems] : [],
    stock_movements: data.movements ? [...data.movements] : [],
    material_request: [] as any[],
    logs: [] as any[],
    sessions: data.sessions || [
      {
        _id: "sess_1",
        userId: data.user?._id || "user_admin",
        token: "admin_token",
        expiresAt: Date.now() + 1000000,
      },
    ],

    async get(id: string) {
      const proj = this.projects.find((p) => p._id === id);
      if (proj) return proj;
      const site = this.sites.find((s) => s._id === id);
      if (site) return site;
      const user = this.users.find((u) => u._id === id);
      if (user) return user;
      const pi = this.project_items.find((p) => p._id === id);
      if (pi) return pi;
      const mov = this.stock_movements.find((m) => m._id === id);
      if (mov) return mov;
      return null;
    },

    async insert(table: string, doc: any) {
      const id = `${table}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newDoc = { _id: id, ...doc, _creationTime: Date.now() };
      if ((this as any)[table]) {
        (this as any)[table].push(newDoc);
      }
      return id;
    },

    async patch(id: string, updates: any) {
      for (const table of Object.values(this)) {
        if (Array.isArray(table)) {
          const item = table.find((x: any) => x._id === id);
          if (item) {
            Object.assign(item, updates);
            return;
          }
        }
      }
    },

    async delete(id: string) {
      for (const table of Object.values(this)) {
        if (Array.isArray(table)) {
          const idx = table.findIndex((x: any) => x._id === id);
          if (idx !== -1) {
            table.splice(idx, 1);
            return;
          }
        }
      }
    },

    query(tableName: string) {
      const self = this;
      let items: any[] = (self as any)[tableName] || [];

      return {
        filter(filterFn: (q: any) => any) {
          const filtered = items.filter((it) => {
            const q = {
              eq: (f1: any, f2: any) => {
                const val = typeof f1 === "function" ? f1() : f1;
                return val === f2;
              },
              field: (name: string) => it[name],
            };
            return filterFn(q);
          });
          return {
            collect: async () => filtered,
            first: async () => filtered[0] || null,
          };
        },

        withIndex(idxName: string, filterFn?: (q: any) => any) {
          let filtered = [...items];
          if (filterFn) {
            const q = {
              eq: (field: string, val: any) => {
                filtered = filtered.filter((i) => i[field] === val);
                return {
                  eq: (field2: string, val2: any) => {
                    filtered = filtered.filter((i) => i[field2] === val2);
                    return q;
                  },
                };
              },
            };
            filterFn(q);
          }
          return {
            collect: async () => filtered,
            first: async () => filtered[0] || null,
            unique: async () => filtered[0] || null,
          };
        },

        collect: async () => [...items],
        first: async () => items[0] || null,
        unique: async () => items[0] || null,
      };
    },
  };

  return { db };
}

describe("S2-10, S2-11 & S2-12: Project Items & 4-Counter Reconciliation", () => {
  it("getProjectBOQDetails computes 4 side-by-side counters from BOQ, POs, GRNs, and movements", async () => {
    const fakeProject = { _id: "proj_1", name: "Alpha Towers", code: "PRJ-01", isActive: true };
    const fakeSite = { _id: "site_1", projectId: "proj_1", name: "Tower 1", code: "S1", isActive: true };

    const fakeBOQItem = {
      _id: "item_1",
      projectId: "proj_1",
      itemName: "Cement OPC 53",
      unit: "bags",
      boqQty: 1000,
      committedQty: 300,
      procuredQty: 200,
    };

    // 2 movements: 1 issue of 50 bags, 1 wastage of 10 bags
    const fakeMovements = [
      {
        _id: "mov_1",
        projectId: "proj_1",
        siteId: "site_1",
        projectItemId: "item_1",
        itemName: "Cement OPC 53",
        movementType: "issue",
        quantity: 50,
      },
      {
        _id: "mov_2",
        projectId: "proj_1",
        siteId: "site_1",
        projectItemId: "item_1",
        itemName: "Cement OPC 53",
        movementType: "wastage",
        quantity: 10,
      },
    ];

    const ctx = createMockContext({
      project: fakeProject,
      site: fakeSite,
      projectItems: [fakeBOQItem],
      movements: fakeMovements,
    });

    const result = await (getProjectBOQDetails as any)._handler(ctx, {
      projectId: "proj_1",
      token: "admin_token",
    });

    expect(result).toBeDefined();
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    // Counter 1: BOQ
    expect(item.boqQty).toBe(1000);
    // Counter 2: Committed
    expect(item.committedQty).toBe(300);
    // Counter 3: Procured
    expect(item.procuredQty).toBe(200);
    // Counter 4: Consumed (50 + 10 = 60)
    expect(item.consumedQty).toBe(60);
    // Remaining Balance: 1000 - 300 - 200 = 500
    expect(item.remainingQty).toBe(500);
    expect(item.isOverProcured).toBe(false);
    expect(item.isOverCommitted).toBe(false);
  });

  it("deleteProjectItem fails closed when committedQty > 0 or procuredQty > 0 or movements exist", async () => {
    // Case 1: Committed POs exist
    const committedItem = {
      _id: "item_1",
      projectId: "proj_1",
      itemName: "Steel TMT",
      unit: "MT",
      committedQty: 10,
      procuredQty: 0,
    };
    const ctxCommitted = createMockContext({ projectItems: [committedItem] });

    await expect(
      (deleteProjectItem as any)._handler(ctxCommitted, { id: "item_1", token: "admin_token" })
    ).rejects.toThrow(/committed in active Purchase Orders/);

    // Case 2: Procured GRNs exist
    const procuredItem = {
      _id: "item_2",
      projectId: "proj_1",
      itemName: "Bricks",
      unit: "nos",
      committedQty: 0,
      procuredQty: 500,
    };
    const ctxProcured = createMockContext({ projectItems: [procuredItem] });

    await expect(
      (deleteProjectItem as any)._handler(ctxProcured, { id: "item_2", token: "admin_token" })
    ).rejects.toThrow(/already procured via Goods Receipts/);

    // Case 3: Stock movements exist
    const cleanItem = {
      _id: "item_3",
      projectId: "proj_1",
      itemName: "Sand",
      unit: "cum",
      committedQty: 0,
      procuredQty: 0,
    };
    const fakeMovement = {
      _id: "mov_1",
      projectId: "proj_1",
      projectItemId: "item_3",
      itemName: "Sand",
      quantity: 10,
      movementType: "receipt",
    };
    const ctxWithMovement = createMockContext({
      projectItems: [cleanItem],
      movements: [fakeMovement],
    });

    await expect(
      (deleteProjectItem as any)._handler(ctxWithMovement, { id: "item_3", token: "admin_token" })
    ).rejects.toThrow(/Immutable stock movement records reference this item/);
  });

  it("bulkImportProjectItems validates rows and inserts multiple items", async () => {
    const ctx = createMockContext({});

    const importResult = await (bulkImportProjectItems as any)._handler(ctx, {
      projectId: "proj_1",
      items: [
        { itemName: "PPC Cement", category: "Cement", unit: "bags", boqQty: 500, estimatedRate: 350 },
        { itemName: "Rebar 12mm", category: "Steel", unit: "MT", boqQty: 25, estimatedRate: 65000 },
      ],
      token: "admin_token",
    });

    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(2);
    expect(ctx.db.project_items.length).toBe(2);
    expect(ctx.db.project_items[0].itemName).toBe("PPC Cement");
    expect(ctx.db.project_items[1].itemName).toBe("Rebar 12mm");
  });

  it("createMR enforces S2-12 BOQ over-allocation guardrail requiring override reason", async () => {
    const boqItem = {
      _id: "item_1",
      projectId: "proj_1",
      itemName: "Cement OPC 53",
      unit: "bags",
      boqQty: 100,
      committedQty: 60,
      procuredQty: 30, // Available = 100 - 60 - 30 = 10
    };

    const ctx = createMockContext({ projectItems: [boqItem] });

    // Requesting 15 bags (exceeds remaining 10) WITHOUT override reason -> MUST THROW
    await expect(
      (createMR as any)._handler(ctx, {
        projectId: "proj_1",
        items: [
          {
            itemName: "Cement OPC 53",
            quantity: 15,
            unit: "bags",
            projectItemId: "item_1",
          },
        ],
        priority: "normal",
        token: "admin_token",
      })
    ).rejects.toThrow(/exceeds remaining BOQ balance/);

    // Requesting 15 bags WITH override reason in description -> MUST PASS
    const passResult = await (createMR as any)._handler(ctx, {
      projectId: "proj_1",
      items: [
        {
          itemName: "Cement OPC 53",
          quantity: 15,
          unit: "bags",
          description: "Extra 5 bags approved for unexpected foundation bedrock leveling",
          projectItemId: "item_1",
        },
      ],
      priority: "normal",
      token: "admin_token",
    });

    expect(passResult.id).toBeDefined();
    expect(passResult.refNo).toMatch(/^MR-\d{4}-\d{4}$/);
  });
});
